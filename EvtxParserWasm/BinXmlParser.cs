using System.Buffers;
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace EvtxParserWasm;

/// <summary>
/// Pre-compiled BinXmlTemplate: string parts interleaved with substitution slots.
/// parts[0] + subs[0] + parts[1] + subs[1] + ... + parts[N]
/// </summary>
internal sealed class CompiledTemplate(string[] parts, int[] subIds, bool[] isOptional)
{
    public readonly string[] Parts = parts;
    public readonly int[] SubIds = subIds;
    public readonly bool[] IsOptional = isOptional;
}

/// <summary>
/// Core BinXml parser. One instance per chunk. Produces XML strings from BinXml token streams.
/// </summary>
internal sealed class BinXmlParser
{
    private static readonly string[] HexLookup = InitHexLookup();

    private readonly byte[] _fileData;
    private readonly int _chunkFileOffset;
    private readonly Dictionary<uint, BinXmlTemplateDefinition> _templates;
    private readonly ConcurrentDictionary<Guid, CompiledTemplate?> _compiledCache;
    private readonly Dictionary<uint, string> _nameCache;

    private static string[] InitHexLookup()
    {
        string[] table = new string[256];
        for (int i = 0; i < 256; i++)
            table[i] = i.ToString("X2");
        return table;
    }

    public BinXmlParser(
        byte[] fileData,
        int chunkFileOffset,
        Dictionary<uint, BinXmlTemplateDefinition> templates,
        ConcurrentDictionary<Guid, CompiledTemplate?> compiledCache)
    {
        _fileData = fileData;
        _chunkFileOffset = chunkFileOffset;
        _templates = templates;
        _compiledCache = compiledCache;
        _nameCache = new Dictionary<uint, string>(64);

        // Pre-populate name cache from chunk common string offset table (64 uint32 entries at chunk offset 128)
        ReadOnlySpan<byte> chunkData = fileData.AsSpan(chunkFileOffset, EvtxChunk.ChunkSize);
        ReadOnlySpan<uint> commonOffsets = MemoryMarshal.Cast<byte, uint>(chunkData.Slice(128, 256));
        for (int i = 0; i < commonOffsets.Length; i++)
        {
            uint offset = commonOffsets[i];
            if (offset != 0 && offset + 8 < EvtxChunk.ChunkSize && !_nameCache.ContainsKey(offset))
            {
                _nameCache[offset] = ReadNameFromChunk(offset);
            }
        }
    }

    private string ReadNameFromChunk(uint chunkRelOffset)
    {
        ReadOnlySpan<byte> chunkData = _fileData.AsSpan(_chunkFileOffset, EvtxChunk.ChunkSize);
        int offset = (int)chunkRelOffset;
        if (offset + 8 > chunkData.Length) return string.Empty;
        ushort numChars = MemoryMarshal.Read<ushort>(chunkData.Slice(offset + 6));
        if (offset + 8 + numChars * 2 > chunkData.Length) return string.Empty;
        ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(chunkData.Slice(offset + 8, numChars * 2));
        return new string(chars);
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private string ReadName(uint chunkRelOffset)
    {
        if (_nameCache.TryGetValue(chunkRelOffset, out string? cached))
            return cached;
        string name = ReadNameFromChunk(chunkRelOffset);
        _nameCache[chunkRelOffset] = name;
        return name;
    }

    /// <summary>
    /// Parses a single record's BinXml event data into XML.
    /// </summary>
    /// <param name="record">The </param>
    public string ParseRecord(EvtxRecord record)
    {
        ReadOnlySpan<byte> eventData = record.GetEventData(_fileData);
        int binxmlChunkBase = record.EventDataFileOffset - _chunkFileOffset;

        ValueStringBuilder vsb = new(stackalloc char[512]);
        int pos = 0;
        ParseDocument(eventData, ref pos, binxmlChunkBase, ref vsb);
        string result = vsb.ToString();
        vsb.Dispose();
        return result;
    }

    private void ParseDocument(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof)
                break;

            if (baseTok == BinXmlToken.FragmentHeader)
            {
                ParseFragment(data, ref pos, binxmlChunkBase, ref vsb);
            }
            else if (baseTok == BinXmlToken.PiTarget)
            {
                pos++; // consume 0x0A
                uint piNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;
                string piName = ReadName(piNameOff);
                vsb.Append("<?");
                vsb.Append(piName);

                if (pos < data.Length && data[pos] == BinXmlToken.PiData)
                {
                    pos++; // consume 0x0B
                    string piText = ReadUnicodeTextStringAsString(data, ref pos);
                    if (piText.Length > 0)
                    {
                        vsb.Append(' ');
                        vsb.Append(piText);
                    }
                }

                vsb.Append("?>");
            }
            else
            {
                break;
            }
        }
    }

    /// <summary>
    /// Parses a BinXml fragment: consumes the 4-byte fragment header (token + major + minor + flags)
    /// then dispatches to either a TemplateInstance or a bare element.
    /// A fragment may appear at the top level of a record or embedded via a BinXmlType (0x21)
    /// substitution value, which contains a nested BinXml-encoded XML fragment or TemplateInstance.
    /// The byte length of an embedded fragment includes up to and including its EOF token.
    /// </summary>
    /// <param name="data">The BinXml byte stream to parse.</param>
    /// <param name="pos">Current read position within <paramref name="data"/>; advanced past the fragment on return.</param>
    /// <param name="binxmlChunkBase">Chunk-relative offset of <paramref name="data"/>, used to resolve inline name structures.</param>
    /// <param name="vsb">String builder that receives the rendered XML output.</param>
    private void ParseFragment(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        if (pos + 4 > data.Length) return;
        pos += 4; // skip fragment header (token + major + minor + flags)

        if (pos >= data.Length) return;

        byte nextTok = data[pos];
        byte nextBase = (byte)(nextTok & ~BinXmlToken.HasMoreDataFlag);

        if (nextBase == BinXmlToken.TemplateInstance)
            ParseTemplateInstance(data, ref pos, binxmlChunkBase, ref vsb);
        else if (nextBase == BinXmlToken.OpenStartElement)
            ParseElement(data, ref pos, null, null, null, binxmlChunkBase, ref vsb);
    }

    private void ParseTemplateInstance(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase,
        ref ValueStringBuilder vsb)
    {
        pos++; // consume 0x0C token
        pos++; // unknown1
        pos += 4; // unknown2
        uint defDataOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        // Determine inline vs back-reference
        uint currentChunkRelOffset = (uint)(binxmlChunkBase + pos);
        bool isInline = defDataOffset == currentChunkRelOffset;

        Guid templateGuid = default;
        uint dataSize = 0;

        if (isInline)
        {
            pos += 4; // next def offset
            templateGuid = MemoryMarshal.Read<Guid>(data.Slice(pos));
            pos += 16;
            dataSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            pos += (int)dataSize; // skip template body (already preloaded)
        }
        else
        {
            // Back-reference: look up from preloaded templates
            if (_templates.TryGetValue(defDataOffset, out BinXmlTemplateDefinition def))
            {
                templateGuid = def.Guid;
                dataSize = def.DataSize;
            }
            else if (defDataOffset + 24 <= EvtxChunk.ChunkSize)
            {
                // Fallback: read directly from chunk
                ReadOnlySpan<byte> chunkData = _fileData.AsSpan(_chunkFileOffset, EvtxChunk.ChunkSize);
                templateGuid = MemoryMarshal.Read<Guid>(chunkData.Slice((int)defDataOffset + 4));
                dataSize = MemoryMarshal.Read<uint>(chunkData.Slice((int)defDataOffset + 20));
            }
        }

        // Read substitution descriptors and values
        uint numValues = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        int descStart = pos;
        ReadOnlySpan<SubstitutionDescriptor> descriptors =
            MemoryMarshal.Cast<byte, SubstitutionDescriptor>(data.Slice(descStart, (int)numValues * 4));
        pos += (int)numValues * 4;

        // Use arrays for value metadata (avoids ref safety issues with stackalloc + ref struct)
        int numVals = (int)numValues;
        int[] valueOffsets = new int[numVals];
        int[] valueSizes = new int[numVals];
        byte[] valueTypes = new byte[numVals];

        for (int i = 0; i < numVals; i++)
        {
            valueOffsets[i] = pos;
            valueSizes[i] = descriptors[i].Size;
            valueTypes[i] = descriptors[i].Type;
            pos += descriptors[i].Size;
        }

        // Lookup/compile template
        if (dataSize == 0) return;

        int tplBodyFileOffset = _chunkFileOffset + (int)defDataOffset + 24;
        if (tplBodyFileOffset + (int)dataSize > _fileData.Length) return;

        // Check compiled cache (GetOrAdd may invoke factory concurrently for same key — harmless)
        CompiledTemplate? compiled = _compiledCache.GetOrAdd(templateGuid,
            _ => CompileTemplate((int)defDataOffset, (int)dataSize));

        if (compiled != null)
        {
            RenderCompiled(compiled, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, ref vsb);
        }
        else
        {
            // Fallback: parse template body with substitutions
            ReadOnlySpan<byte> tplBody = _fileData.AsSpan(tplBodyFileOffset, (int)dataSize);
            int tplPos = 0;
            int tplChunkBase = (int)defDataOffset + 24;

            // Skip fragment header
            if (tplBody.Length >= 4 && tplBody[0] == BinXmlToken.FragmentHeader)
                tplPos += 4;

            ParseContent(tplBody, ref tplPos, valueOffsets, valueSizes, valueTypes, tplChunkBase, ref vsb);
        }
    }

    private void ParseElement(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        pos++; // consume token

        pos += 2; // depId
        pos += 4; // dataSize
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        // Inline name structure present only when defined here
        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        string elemName = ReadName(nameOffset);
        vsb.Append('<');
        vsb.Append(elemName);

        // Parse attribute list if present
        if (hasAttrs)
        {
            uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            int attrEnd = pos + (int)attrListSize;

            while (pos < attrEnd)
            {
                byte attrTok = data[pos];
                byte attrBase = (byte)(attrTok & ~BinXmlToken.HasMoreDataFlag);
                if (attrBase != BinXmlToken.Attribute) break;

                pos++; // consume attribute token
                uint attrNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;

                // Inline name structure
                if (attrNameOff == (uint)(binxmlChunkBase + pos))
                {
                    ushort attrNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
                    pos += 10 + attrNameChars * 2;
                }

                string attrName = ReadName(attrNameOff);
                vsb.Append(' ');
                vsb.Append(attrName);
                vsb.Append("=\"");
                ParseContent(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, ref vsb);
                vsb.Append('"');
            }
        }

        // Close token
        if (pos >= data.Length)
        {
            vsb.Append("/>");
            return;
        }

        byte closeTok = data[pos];
        if (closeTok == BinXmlToken.CloseEmptyElement)
        {
            pos++;
            vsb.Append("/>");
        }
        else if (closeTok == BinXmlToken.CloseStartElement)
        {
            pos++;
            vsb.Append('>');
            ParseContent(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, ref vsb);
            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;
            vsb.Append("</");
            vsb.Append(elemName);
            vsb.Append('>');
        }
        else
        {
            vsb.Append("/>");
        }
    }

    private void ParseContent(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            // Break tokens
            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            // using a swtich statement here cause we're checking bytes against bytes - thus swtich is quicker than if/else
            // see https://www.reddit.com/r/csharp/comments/f9wl6y/is_there_a_performance_difference_in_using_a/ (or msdocs) to learn more
            switch (baseTok)
            {
                case BinXmlToken.OpenStartElement:
                    ParseElement(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, ref vsb);
                    break;
                case BinXmlToken.Value:
                {
                    pos++; // consume token
                    pos++; // value type
                    string str = ReadUnicodeTextStringAsString(data, ref pos);
                    AppendXmlEscaped(ref vsb, str.AsSpan());
                    break;
                }
                case BinXmlToken.NormalSubstitution:
                {
                    pos++; // consume token
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++; // subValType
                    if (valueOffsets != null && subId < valueOffsets.Length)
                    {
                        RenderValue(valueSizes![subId], valueTypes![subId], valueOffsets[subId], binxmlChunkBase,
                            ref vsb);
                    }

                    break;
                }
                case BinXmlToken.OptionalSubstitution:
                {
                    pos++; // consume token
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++; // subValType
                    if (valueOffsets != null && subId < valueOffsets.Length)
                    {
                        byte valType = valueTypes![subId];
                        int valSize = valueSizes![subId];
                        if (valType != BinXmlValueType.Null && valSize > 0)
                        {
                            RenderValue(valSize, valType, valueOffsets[subId], binxmlChunkBase, ref vsb);
                        }
                    }

                    break;
                }
                case BinXmlToken.CharRef:
                {
                    pos++; // consume token
                    ushort charVal = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    vsb.Append("&#");
                    vsb.AppendFormatted(charVal);
                    vsb.Append(';');
                    break;
                }
                case BinXmlToken.EntityRef:
                {
                    pos++; // consume token
                    uint nameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                    pos += 4;
                    string entityName = ReadName(nameOff);
                    vsb.Append('&');
                    vsb.Append(entityName);
                    vsb.Append(';');
                    break;
                }
                case BinXmlToken.CDataSection:
                {
                    pos++; // consume token
                    string cdataStr = ReadUnicodeTextStringAsString(data, ref pos);
                    vsb.Append("<![CDATA[");
                    vsb.Append(cdataStr);
                    vsb.Append("]]>");
                    break;
                }
                case BinXmlToken.TemplateInstance:
                    ParseTemplateInstance(data, ref pos, binxmlChunkBase, ref vsb);
                    break;
                case BinXmlToken.FragmentHeader:
                    ParseFragment(data, ref pos, binxmlChunkBase, ref vsb);
                    break;
                default:
                    pos++;
                    break;
            }
        }
    }

    // ---- Template compilation ----

    private CompiledTemplate? CompileTemplate(int defDataOffset, int dataSize)
    {
        int tplBodyFileOffset = _chunkFileOffset + defDataOffset + 24;
        if (tplBodyFileOffset + dataSize > _fileData.Length) return null;

        ReadOnlySpan<byte> tplBody = _fileData.AsSpan(tplBodyFileOffset, dataSize);
        int tplChunkBase = defDataOffset + 24;

        List<string> parts = new() { string.Empty };
        List<int> subIds = new();
        List<bool> isOptional = new();
        bool bail = false;

        int pos = 0;
        // Skip fragment header
        if (tplBody.Length >= 4 && tplBody[0] == BinXmlToken.FragmentHeader)
            pos += 4;

        CompileContent(tplBody, ref pos, tplChunkBase, parts, subIds, isOptional, ref bail);

        if (bail) return null;
        return new CompiledTemplate(parts.ToArray(), subIds.ToArray(), isOptional.ToArray());
    }

    private void CompileContent(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase,
        List<string> parts, List<int> subIds, List<bool> isOptional, ref bool bail)
    {
        while (pos < data.Length)
        {
            if (bail) return;
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            if (baseTok == BinXmlToken.OpenStartElement)
            {
                CompileElement(data, ref pos, binxmlChunkBase, parts, subIds, isOptional, ref bail);
            }
            else if (baseTok == BinXmlToken.Value)
            {
                pos++; // token
                pos++; // value type
                string str = ReadUnicodeTextStringAsString(data, ref pos);
                parts[^1] += XmlEscapeString(str);
            }
            else if (baseTok == BinXmlToken.NormalSubstitution)
            {
                pos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                pos++; // subValType
                subIds.Add(subId);
                isOptional.Add(false);
                parts.Add(string.Empty);
            }
            else if (baseTok == BinXmlToken.OptionalSubstitution)
            {
                pos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                pos++; // subValType
                subIds.Add(subId);
                isOptional.Add(true);
                parts.Add(string.Empty);
            }
            else if (baseTok == BinXmlToken.CharRef)
            {
                pos++;
                ushort charVal = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                parts[^1] += $"&#{charVal};";
            }
            else if (baseTok == BinXmlToken.EntityRef)
            {
                pos++;
                uint nameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;
                string entityName = ReadName(nameOff);
                parts[^1] += $"&{entityName};";
            }
            else if (baseTok == BinXmlToken.CDataSection)
            {
                pos++;
                string cdataStr = ReadUnicodeTextStringAsString(data, ref pos);
                parts[^1] += $"<![CDATA[{cdataStr}]]>";
            }
            else if (baseTok == BinXmlToken.TemplateInstance || baseTok == BinXmlToken.FragmentHeader)
            {
                bail = true;
                return;
            }
            else
            {
                bail = true;
                return;
            }
        }
    }

    private void CompileElement(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase,
        List<string> parts, List<int> subIds, List<bool> isOptional, ref bool bail)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        pos++;

        pos += 2; // depId
        pos += 4; // dataSize
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        string elemName = ReadName(nameOffset);
        parts[^1] += $"<{elemName}";

        if (hasAttrs)
        {
            uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            int attrEnd = pos + (int)attrListSize;

            while (pos < attrEnd)
            {
                if (bail) return;
                byte attrTok = data[pos];
                byte attrBase = (byte)(attrTok & ~BinXmlToken.HasMoreDataFlag);
                if (attrBase != BinXmlToken.Attribute) break;

                pos++;
                uint attrNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;
                if (attrNameOff == (uint)(binxmlChunkBase + pos))
                {
                    ushort attrNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
                    pos += 10 + attrNameChars * 2;
                }

                string attrName = ReadName(attrNameOff);
                parts[^1] += $" {attrName}=\"";
                CompileContent(data, ref pos, binxmlChunkBase, parts, subIds, isOptional, ref bail);
                if (bail) return;
                parts[^1] += "\"";
            }
        }

        if (pos >= data.Length)
        {
            parts[^1] += "/>";
            return;
        }

        byte closeTok = data[pos];
        if (closeTok == BinXmlToken.CloseEmptyElement)
        {
            pos++;
            parts[^1] += "/>";
        }
        else if (closeTok == BinXmlToken.CloseStartElement)
        {
            pos++;
            parts[^1] += ">";
            CompileContent(data, ref pos, binxmlChunkBase, parts, subIds, isOptional, ref bail);
            if (bail) return;
            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;
            parts[^1] += $"</{elemName}>";
        }
        else
        {
            parts[^1] += "/>";
        }
    }

    // ---- Compiled template rendering ----

    private void RenderCompiled(CompiledTemplate compiled,
        int[] valueOffsets, int[] valueSizes, byte[] valueTypes,
        int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        vsb.Append(compiled.Parts[0]);
        for (int i = 0; i < compiled.SubIds.Length; i++)
        {
            int subId = compiled.SubIds[i];
            if (subId < valueOffsets.Length)
            {
                byte valType = valueTypes[subId];
                int valSize = valueSizes[subId];
                if (!compiled.IsOptional[i] || (valType != BinXmlValueType.Null && valSize > 0))
                {
                    RenderValue(valSize, valType, valueOffsets[subId], binxmlChunkBase, ref vsb);
                }
            }

            vsb.Append(compiled.Parts[i + 1]);
        }
    }

    /// <summary>
    /// Renders the value text (BinXmlValueText) 
    /// </summary>
    /// <param name="size"></param>
    /// <param name="valueType"></param>
    /// <param name="fileOffset"></param>
    /// <param name="binxmlChunkBase"></param>
    /// <param name="vsb"></param>
    private void RenderValue(int size, byte valueType, int fileOffset, int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        if (size == 0) return;
        ReadOnlySpan<byte> valueBytes = _fileData.AsSpan(fileOffset, size);

        // Array flag
        if ((valueType & BinXmlValueType.ArrayFlag) != 0)
        {
            RenderArray(valueBytes, (byte)(valueType & 0x7F), fileOffset, binxmlChunkBase, ref vsb);
            return;
        }

        switch (valueType)
        {
            case BinXmlValueType.Null:
                break;

            case BinXmlValueType.String:
            {
                ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(valueBytes);
                // Trim trailing null
                if (chars.Length > 0 && chars[^1] == '\0')
                    chars = chars[..^1];
                AppendXmlEscaped(ref vsb, chars);
                break;
            }

            case BinXmlValueType.AnsiString:
            {
                for (int i = 0; i < valueBytes.Length; i++)
                {
                    byte b = valueBytes[i];
                    if (b == 0) break;
                    if (b == '&') vsb.Append("&amp;");
                    else if (b == '<') vsb.Append("&lt;");
                    else if (b == '>') vsb.Append("&gt;");
                    else if (b == '"') vsb.Append("&quot;");
                    else if (b == '\'') vsb.Append("&apos;");
                    else vsb.Append((char)b);
                }

                break;
            }

            case BinXmlValueType.Int8:
                vsb.AppendFormatted((sbyte)valueBytes[0]);
                break;

            case BinXmlValueType.UInt8:
                vsb.AppendFormatted(valueBytes[0]);
                break;

            case BinXmlValueType.Int16:
                vsb.AppendFormatted(MemoryMarshal.Read<short>(valueBytes));
                break;

            case BinXmlValueType.UInt16:
                vsb.AppendFormatted(MemoryMarshal.Read<ushort>(valueBytes));
                break;

            case BinXmlValueType.Int32:
                vsb.AppendFormatted(MemoryMarshal.Read<int>(valueBytes));
                break;

            case BinXmlValueType.UInt32:
                vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes));
                break;

            case BinXmlValueType.Int64:
                vsb.AppendFormatted(MemoryMarshal.Read<long>(valueBytes));
                break;

            case BinXmlValueType.UInt64:
                vsb.AppendFormatted(MemoryMarshal.Read<ulong>(valueBytes));
                break;

            case BinXmlValueType.Float:
                vsb.AppendFormatted(MemoryMarshal.Read<float>(valueBytes));
                break;

            case BinXmlValueType.Double:
                vsb.AppendFormatted(MemoryMarshal.Read<double>(valueBytes));
                break;

            case BinXmlValueType.Bool:
                vsb.Append(MemoryMarshal.Read<uint>(valueBytes) != 0 ? "true" : "false");
                break;

            case BinXmlValueType.Binary:
                AppendHex(ref vsb, valueBytes);
                break;

            case BinXmlValueType.Guid:
            {
                if (size < 16) break;
                RenderGuid(valueBytes, ref vsb);
                break;
            }

            case BinXmlValueType.SizeT:
            {
                vsb.Append("0x");
                if (size == 8)
                {
                    ulong val = MemoryMarshal.Read<ulong>(valueBytes);
                    vsb.AppendFormatted(val, "x16");
                }
                else
                {
                    uint val = MemoryMarshal.Read<uint>(valueBytes);
                    vsb.AppendFormatted(val, "x8");
                }

                break;
            }

            case BinXmlValueType.FileTime:
            {
                if (size < 8) break;
                long ticks = MemoryMarshal.Read<long>(valueBytes);
                if (ticks == 0) break;
                const long FileTimeEpochDelta = 504911232000000000L;
                DateTime dt = new DateTime(ticks + FileTimeEpochDelta, DateTimeKind.Utc);
                vsb.AppendFormatted(dt, "yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'");
                break;
            }

            case BinXmlValueType.SystemTime:
            {
                if (size < 16) break;
                ushort yr = MemoryMarshal.Read<ushort>(valueBytes);
                ushort mo = MemoryMarshal.Read<ushort>(valueBytes.Slice(2));
                ushort dy = MemoryMarshal.Read<ushort>(valueBytes.Slice(6));
                ushort hr = MemoryMarshal.Read<ushort>(valueBytes.Slice(8));
                ushort mn = MemoryMarshal.Read<ushort>(valueBytes.Slice(10));
                ushort sc = MemoryMarshal.Read<ushort>(valueBytes.Slice(12));
                ushort ms = MemoryMarshal.Read<ushort>(valueBytes.Slice(14));
                vsb.AppendFormatted(yr, "D4");
                vsb.Append('-');
                vsb.AppendFormatted(mo, "D2");
                vsb.Append('-');
                vsb.AppendFormatted(dy, "D2");
                vsb.Append('T');
                vsb.AppendFormatted(hr, "D2");
                vsb.Append(':');
                vsb.AppendFormatted(mn, "D2");
                vsb.Append(':');
                vsb.AppendFormatted(sc, "D2");
                vsb.Append('.');
                vsb.AppendFormatted(ms, "D3");
                vsb.Append('Z');
                break;
            }

            case BinXmlValueType.Sid:
            {
                if (size < 8) break;
                byte revision = valueBytes[0];
                byte subCount = valueBytes[1];
                long authority = 0;
                for (int i = 2; i < 8; i++)
                    authority = authority * 256 + valueBytes[i];
                vsb.Append("S-");
                vsb.AppendFormatted(revision);
                vsb.Append('-');
                vsb.AppendFormatted(authority);
                for (int i = 0; i < subCount; i++)
                {
                    int subOff = 8 + i * 4;
                    if (subOff + 4 > size) break;
                    vsb.Append('-');
                    vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes.Slice(subOff)));
                }

                break;
            }

            case BinXmlValueType.HexInt32:
                vsb.Append("0x");
                vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes), "x8");
                break;

            case BinXmlValueType.HexInt64:
                vsb.Append("0x");
                vsb.AppendFormatted(MemoryMarshal.Read<ulong>(valueBytes), "x16");
                break;

            case BinXmlValueType.BinXml:
            {
                int embeddedChunkBase = fileOffset - _chunkFileOffset;
                int embeddedPos = 0;
                ParseDocument(valueBytes, ref embeddedPos, embeddedChunkBase, ref vsb);
                break;
            }

            case BinXmlValueType.EvtHandle:
            case BinXmlValueType.EvtXml:
            default:
                AppendHex(ref vsb, valueBytes);
                break;
        }
    }

    private void RenderArray(ReadOnlySpan<byte> valueBytes, byte baseType, int fileOffset,
        int binxmlChunkBase, ref ValueStringBuilder vsb)
    {
        // String arrays: null-terminated UTF-16LE strings concatenated
        if (baseType == BinXmlValueType.String)
        {
            ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(valueBytes);
            bool first = true;
            int start = 0;
            for (int i = 0; i <= chars.Length; i++)
            {
                if (i == chars.Length || chars[i] == '\0')
                {
                    if (i > start)
                    {
                        if (!first) vsb.Append(", ");
                        AppendXmlEscaped(ref vsb, chars.Slice(start, i - start));
                        first = false;
                    }

                    start = i + 1;
                }
            }

            return;
        }

        // Fixed-size array types
        int elemSize = GetElementSize(baseType);
        if (elemSize > 0 && valueBytes.Length >= elemSize)
        {
            bool first = true;
            for (int i = 0; i + elemSize <= valueBytes.Length; i += elemSize)
            {
                if (!first) vsb.Append(", ");
                RenderValue(elemSize, baseType, fileOffset + i, binxmlChunkBase, ref vsb);
                first = false;
            }

            return;
        }

        // Fallback: hex
        AppendHex(ref vsb, valueBytes);
    }

    private static int GetElementSize(byte baseType)
    {
        return baseType switch
        {
            BinXmlValueType.Int8 or BinXmlValueType.UInt8 => 1,
            BinXmlValueType.Int16 or BinXmlValueType.UInt16 => 2,
            BinXmlValueType.Int32 or BinXmlValueType.UInt32 or BinXmlValueType.Float or BinXmlValueType.Bool
                or BinXmlValueType.HexInt32 => 4,
            BinXmlValueType.Int64 or BinXmlValueType.UInt64 or BinXmlValueType.Double or BinXmlValueType.FileTime
                or BinXmlValueType.HexInt64 => 8,
            BinXmlValueType.Guid or BinXmlValueType.SystemTime => 16,
            _ => 0
        };
    }

    // ---- GUID rendering (matches TS format: {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}) ----

    private void RenderGuid(ReadOnlySpan<byte> b, ref ValueStringBuilder vsb)
    {
        uint d1 = MemoryMarshal.Read<uint>(b);
        ushort d2 = MemoryMarshal.Read<ushort>(b.Slice(4));
        ushort d3 = MemoryMarshal.Read<ushort>(b.Slice(6));

        vsb.Append('{');
        vsb.AppendFormatted(d1, "x8");
        vsb.Append('-');
        vsb.AppendFormatted(d2, "x4");
        vsb.Append('-');
        vsb.AppendFormatted(d3, "x4");
        vsb.Append('-');
        vsb.Append(HexLookup[b[8]]);
        vsb.Append(HexLookup[b[9]]);
        vsb.Append(HexLookup[b[10]]);
        vsb.Append(HexLookup[b[11]]);
        vsb.Append('-');
        vsb.Append(HexLookup[b[12]]);
        vsb.Append(HexLookup[b[13]]);
        vsb.Append(HexLookup[b[14]]);
        vsb.Append(HexLookup[b[15]]);
        vsb.Append('}');
    }

    // ---- Helpers ----

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ReadUnicodeTextStringAsString(ReadOnlySpan<byte> data, ref int pos)
    {
        ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
        pos += 2;
        ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(data.Slice(pos, numChars * 2));
        pos += numChars * 2;
        return new string(chars);
    }

    private static void AppendXmlEscaped(ref ValueStringBuilder vsb, scoped ReadOnlySpan<char> text)
    {
        // Fast path: no XML-special chars and no surrogates → bulk append
        if (text.IndexOfAny('&', '<', '>') < 0 &&
            text.IndexOfAny('"', '\'') < 0 &&
            text.IndexOfAnyInRange('\uD800', '\uDFFF') < 0)
        {
            vsb.Append(text);
            return;
        }

        // Slow path: XML-escape + replace unpaired surrogates with U+FFFD
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            if (char.IsHighSurrogate(c))
            {
                if (i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
                {
                    vsb.Append(c);
                    vsb.Append(text[++i]);
                }
                else
                {
                    vsb.Append('\uFFFD');
                }
            }
            else if (char.IsLowSurrogate(c))
            {
                vsb.Append('\uFFFD');
            }
            else
            {
                switch (c)
                {
                    case '&': vsb.Append("&amp;"); break;
                    case '<': vsb.Append("&lt;"); break;
                    case '>': vsb.Append("&gt;"); break;
                    case '"': vsb.Append("&quot;"); break;
                    case '\'': vsb.Append("&apos;"); break;
                    default: vsb.Append(c); break;
                }
            }
        }
    }

    private static string XmlEscapeString(string str)
    {
        if (str.AsSpan().IndexOfAny('&', '<', '>') < 0 && str.AsSpan().IndexOfAny('"', '\'') < 0)
            return str;
        return str.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
            .Replace("\"", "&quot;").Replace("'", "&apos;");
    }

    private static void AppendHex(ref ValueStringBuilder vsb, ReadOnlySpan<byte> data)
    {
        for (int i = 0; i < data.Length; i++)
            vsb.Append(HexLookup[data[i]]);
    }

    // ==== JSON rendering ====

    private static readonly JsonWriterOptions JsonOpts = new() { SkipValidation = true };

    /// <summary>
    /// Parses a single record's BinXml event data into UTF-8 JSON bytes.
    /// </summary>
    public byte[] ParseRecordJson(EvtxRecord record)
    {
        ReadOnlySpan<byte> eventData = record.GetEventData(_fileData);
        int binxmlChunkBase = record.EventDataFileOffset - _chunkFileOffset;

        ArrayBufferWriter<byte> buffer = new(512);
        using Utf8JsonWriter w = new(buffer, JsonOpts);
        int pos = 0;
        ParseDocumentJson(eventData, ref pos, binxmlChunkBase, w);
        w.Flush();
        return buffer.WrittenSpan.ToArray();
    }

    private void ParseDocumentJson(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase, Utf8JsonWriter w)
    {
        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof)
                break;

            if (baseTok == BinXmlToken.FragmentHeader)
            {
                ParseFragmentJson(data, ref pos, binxmlChunkBase, w);
            }
            else if (baseTok == BinXmlToken.PiTarget)
            {
                // Skip PI for JSON — no equivalent
                pos++;
                pos += 4; // nameOffset
                if (pos < data.Length && data[pos] == BinXmlToken.PiData)
                {
                    pos++;
                    ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2 + numChars * 2;
                }
            }
            else
            {
                break;
            }
        }
    }

    private void ParseFragmentJson(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase, Utf8JsonWriter w)
    {
        if (pos + 4 > data.Length) return;
        pos += 4; // fragment header

        if (pos >= data.Length) return;

        byte nextTok = data[pos];
        byte nextBase = (byte)(nextTok & ~BinXmlToken.HasMoreDataFlag);

        if (nextBase == BinXmlToken.TemplateInstance)
            ParseTemplateInstanceJson(data, ref pos, binxmlChunkBase, w);
        else if (nextBase == BinXmlToken.OpenStartElement)
            RenderElementJson(data, ref pos, null, null, null, binxmlChunkBase, w);
    }

    private void ParseTemplateInstanceJson(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase, Utf8JsonWriter w)
    {
        pos++; // 0x0C token
        pos++; // unknown1
        pos += 4; // unknown2
        uint defDataOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        uint currentChunkRelOffset = (uint)(binxmlChunkBase + pos);
        bool isInline = defDataOffset == currentChunkRelOffset;

        uint dataSize = 0;

        if (isInline)
        {
            pos += 4; // next def offset
            pos += 16; // guid
            dataSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            pos += (int)dataSize;
        }
        else
        {
            if (_templates.TryGetValue(defDataOffset, out BinXmlTemplateDefinition def))
                dataSize = def.DataSize;
            else if (defDataOffset + 24 <= EvtxChunk.ChunkSize)
            {
                ReadOnlySpan<byte> chunkData = _fileData.AsSpan(_chunkFileOffset, EvtxChunk.ChunkSize);
                dataSize = MemoryMarshal.Read<uint>(chunkData.Slice((int)defDataOffset + 20));
            }
        }

        // Read substitution descriptors
        uint numValues = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        int descStart = pos;
        ReadOnlySpan<SubstitutionDescriptor> descriptors =
            MemoryMarshal.Cast<byte, SubstitutionDescriptor>(data.Slice(descStart, (int)numValues * 4));
        pos += (int)numValues * 4;

        int numVals = (int)numValues;
        int[] valueOffsets = new int[numVals];
        int[] valueSizes = new int[numVals];
        byte[] valueTypes = new byte[numVals];

        for (int i = 0; i < numVals; i++)
        {
            valueOffsets[i] = pos;
            valueSizes[i] = descriptors[i].Size;
            valueTypes[i] = descriptors[i].Type;
            pos += descriptors[i].Size;
        }

        if (dataSize == 0) return;

        int tplBodyFileOffset = _chunkFileOffset + (int)defDataOffset + 24;
        if (tplBodyFileOffset + (int)dataSize > _fileData.Length) return;

        ReadOnlySpan<byte> tplBody = _fileData.AsSpan(tplBodyFileOffset, (int)dataSize);
        int tplPos = 0;
        int tplChunkBase = (int)defDataOffset + 24;

        if (tplBody.Length >= 4 && tplBody[0] == BinXmlToken.FragmentHeader)
            tplPos += 4;

        ParseContentJson(tplBody, ref tplPos, valueOffsets, valueSizes, valueTypes, tplChunkBase, w);
    }

    private void ParseContentJson(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, Utf8JsonWriter w)
    {
        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            switch (baseTok)
            {
                case BinXmlToken.OpenStartElement:
                    RenderElementJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, w);
                    break;
                case BinXmlToken.Value:
                {
                    pos++;
                    pos++; // value type
                    string str = ReadUnicodeTextStringAsString(data, ref pos);
                    w.WriteStringValue(str);
                    break;
                }
                case BinXmlToken.NormalSubstitution:
                {
                    pos++;
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++; // subValType
                    if (valueOffsets != null && subId < valueOffsets.Length)
                        RenderValueJson(valueSizes![subId], valueTypes![subId], valueOffsets[subId], binxmlChunkBase,
                            w);
                    break;
                }
                case BinXmlToken.OptionalSubstitution:
                {
                    pos++;
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++; // subValType
                    if (valueOffsets != null && subId < valueOffsets.Length)
                    {
                        byte valType = valueTypes![subId];
                        int valSize = valueSizes![subId];
                        if (valType != BinXmlValueType.Null && valSize > 0)
                            RenderValueJson(valSize, valType, valueOffsets[subId], binxmlChunkBase, w);
                    }

                    break;
                }
                case BinXmlToken.CharRef:
                {
                    pos++;
                    ushort charVal = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    w.WriteStringValue(char.ConvertFromUtf32(charVal));
                    break;
                }
                case BinXmlToken.EntityRef:
                {
                    pos++;
                    uint nameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                    pos += 4;
                    string entityName = ReadName(nameOff);
                    // Resolve common XML entities
                    string resolved = entityName switch
                    {
                        "amp" => "&",
                        "lt" => "<",
                        "gt" => ">",
                        "quot" => "\"",
                        "apos" => "'",
                        _ => $"&{entityName};"
                    };
                    w.WriteStringValue(resolved);
                    break;
                }
                case BinXmlToken.CDataSection:
                {
                    pos++;
                    string cdataStr = ReadUnicodeTextStringAsString(data, ref pos);
                    w.WriteStringValue(cdataStr);
                    break;
                }
                case BinXmlToken.TemplateInstance:
                    ParseTemplateInstanceJson(data, ref pos, binxmlChunkBase, w);
                    break;
                case BinXmlToken.FragmentHeader:
                    ParseFragmentJson(data, ref pos, binxmlChunkBase, w);
                    break;
                default:
                    pos++;
                    break;
            }
        }
    }

    /// <summary>
    /// Classification result for an element's children — determines JSON representation.
    /// </summary>
    private readonly struct ElementClassification
    {
        public readonly bool HasChildElements;
        public readonly bool HasText;
        public readonly bool IsEmpty;

        public ElementClassification(bool hasChildElements, bool hasText, bool isEmpty)
        {
            HasChildElements = hasChildElements;
            HasText = hasText;
            IsEmpty = isEmpty;
        }
    }

    /// <summary>
    /// Pre-scans element children to classify without consuming position.
    /// </summary>
    private ElementClassification ClassifyChildren(ReadOnlySpan<byte> data, int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes, int binxmlChunkBase)
    {
        bool hasChildElements = false;
        bool hasText = false;

        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            if (baseTok == BinXmlToken.OpenStartElement)
            {
                hasChildElements = true;
                // Skip past this element to continue scanning
                SkipElement(data, ref pos, binxmlChunkBase);
            }
            else if (baseTok == BinXmlToken.Value)
            {
                hasText = true;
                pos++;
                pos++; // value type
                ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2 + numChars * 2;
            }
            else if (baseTok == BinXmlToken.NormalSubstitution)
            {
                pos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                byte subValType = data[pos];
                pos++;
                if (valueOffsets != null && subId < valueOffsets.Length)
                {
                    byte vt = valueTypes![subId];
                    if (vt == BinXmlValueType.BinXml)
                        hasChildElements = true;
                    else if (valueSizes![subId] > 0)
                        hasText = true;
                }
            }
            else if (baseTok == BinXmlToken.OptionalSubstitution)
            {
                pos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                pos++; // subValType
                if (valueOffsets != null && subId < valueOffsets.Length)
                {
                    byte vt = valueTypes![subId];
                    int vs = valueSizes![subId];
                    if (vt != BinXmlValueType.Null && vs > 0)
                    {
                        if (vt == BinXmlValueType.BinXml)
                            hasChildElements = true;
                        else
                            hasText = true;
                    }
                }
            }
            else if (baseTok == BinXmlToken.CharRef)
            {
                hasText = true;
                pos += 3;
            }
            else if (baseTok == BinXmlToken.EntityRef)
            {
                hasText = true;
                pos += 5;
            }
            else if (baseTok == BinXmlToken.CDataSection)
            {
                hasText = true;
                pos++;
                ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2 + numChars * 2;
            }
            else if (baseTok == BinXmlToken.TemplateInstance)
            {
                hasChildElements = true;
                break; // can't easily skip templates
            }
            else
            {
                pos++;
            }
        }

        bool isEmpty = !hasChildElements && !hasText;
        return new ElementClassification(hasChildElements, hasText, isEmpty);
    }

    /// <summary>
    /// Skips an element without producing output (for classification pre-scanning).
    /// </summary>
    private void SkipElement(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        pos++;
        pos += 2; // depId
        uint elemDataSize = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        if (hasAttrs)
        {
            uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4 + (int)attrListSize;
        }

        if (pos >= data.Length) return;
        byte closeTok = data[pos];
        if (closeTok == BinXmlToken.CloseEmptyElement)
        {
            pos++;
        }
        else if (closeTok == BinXmlToken.CloseStartElement)
        {
            pos++;
            // Skip content until EndElement
            SkipContent(data, ref pos, binxmlChunkBase);
            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;
        }
        else
        {
            pos++;
        }
    }

    private void SkipContent(ReadOnlySpan<byte> data, ref int pos, int binxmlChunkBase)
    {
        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            if (baseTok == BinXmlToken.OpenStartElement)
            {
                SkipElement(data, ref pos, binxmlChunkBase);
            }
            else if (baseTok == BinXmlToken.Value)
            {
                pos++;
                pos++;
                ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2 + numChars * 2;
            }
            else if (baseTok == BinXmlToken.NormalSubstitution || baseTok == BinXmlToken.OptionalSubstitution)
            {
                pos += 4; // token + subId(2) + valType(1)
            }
            else if (baseTok == BinXmlToken.CharRef)
            {
                pos += 3;
            }
            else if (baseTok == BinXmlToken.EntityRef)
            {
                pos += 5;
            }
            else if (baseTok == BinXmlToken.CDataSection)
            {
                pos++;
                ushort numChars = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2 + numChars * 2;
            }
            else
            {
                pos++;
            }
        }
    }

    /// <summary>
    /// Renders a single element as JSON. Core method for JSON output.
    /// </summary>
    private void RenderElementJson(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, Utf8JsonWriter w)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        pos++;

        pos += 2; // depId
        pos += 4; // dataSize
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        string elemName = ReadName(nameOffset);

        // Collect attributes
        List<(string name, string value)>? attrs = null;
        if (hasAttrs)
        {
            uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            int attrEnd = pos + (int)attrListSize;

            attrs = new List<(string, string)>();
            while (pos < attrEnd)
            {
                byte attrTok = data[pos];
                byte attrBase = (byte)(attrTok & ~BinXmlToken.HasMoreDataFlag);
                if (attrBase != BinXmlToken.Attribute) break;

                pos++;
                uint attrNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;
                if (attrNameOff == (uint)(binxmlChunkBase + pos))
                {
                    ushort attrNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
                    pos += 10 + attrNameChars * 2;
                }

                string attrName = ReadName(attrNameOff);
                string attrValue = RenderContentToString(data, ref pos, valueOffsets, valueSizes, valueTypes,
                    binxmlChunkBase);
                attrs.Add((attrName, attrValue));
            }
        }

        // Close token
        if (pos >= data.Length)
        {
            // Self-closing, no content
            w.WriteNullValue();
            return;
        }

        byte closeTok = data[pos];
        if (closeTok == BinXmlToken.CloseEmptyElement)
        {
            pos++;
            // Check if all attrs are empty — if so, null; else write object
            bool allAttrsEmpty = true;
            if (attrs != null)
            {
                foreach (var (_, v) in attrs)
                    if (v.Length > 0)
                    {
                        allAttrsEmpty = false;
                        break;
                    }
            }

            if (attrs == null || allAttrsEmpty)
            {
                w.WriteNullValue();
            }
            else
            {
                w.WriteStartObject();
                w.WritePropertyName("#attributes");
                w.WriteStartObject();
                foreach (var (n, v) in attrs)
                    w.WriteString(n, v);
                w.WriteEndObject();
                w.WriteEndObject();
            }

            return;
        }

        if (closeTok != BinXmlToken.CloseStartElement)
        {
            w.WriteNullValue();
            return;
        }

        pos++; // consume CloseStartElement

        // Classify children
        ElementClassification cls = ClassifyChildren(data, pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase);

        bool hasNonEmptyAttrs = false;
        if (attrs != null)
        {
            foreach (var (_, v) in attrs)
                if (v.Length > 0)
                {
                    hasNonEmptyAttrs = true;
                    break;
                }
        }

        // Check for EventData/UserData flattening
        bool isDataContainer = elemName == "EventData" || elemName == "UserData";

        if (cls.IsEmpty && !hasNonEmptyAttrs)
        {
            // Empty element — null
            SkipToEndElement(data, ref pos);
            w.WriteNullValue();
        }
        else if (!cls.HasChildElements && !hasNonEmptyAttrs)
        {
            // Scalar element — direct value
            RenderTextContentJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, w);
            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;
        }
        else
        {
            // Object element
            w.WriteStartObject();

            if (hasNonEmptyAttrs)
            {
                w.WritePropertyName("#attributes");
                w.WriteStartObject();
                foreach (var (n, v) in attrs!)
                    w.WriteString(n, v);
                w.WriteEndObject();
            }

            if (cls.HasText && cls.HasChildElements)
            {
                // Mixed content — capture text as #text
                string textVal =
                    RenderContentToString(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase);
                if (textVal.Length > 0)
                    w.WriteString("#text", textVal);
            }
            else
            {
                // Render child elements as properties
                RenderChildElementsJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, w,
                    isDataContainer);
            }

            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;

            w.WriteEndObject();
        }
    }

    /// <summary>
    /// Renders text-only content as a JSON value (string or typed primitive).
    /// </summary>
    private void RenderTextContentJson(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, Utf8JsonWriter w)
    {
        // Check if there's a single substitution — render as typed value
        int savedPos = pos;
        int subCount = 0;
        int firstSubId = -1;
        bool hasOtherContent = false;

        while (savedPos < data.Length)
        {
            byte tok = data[savedPos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof || baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute) break;

            if (baseTok == BinXmlToken.NormalSubstitution || baseTok == BinXmlToken.OptionalSubstitution)
            {
                savedPos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(savedPos));
                savedPos += 2;
                savedPos++; // valType
                if (subCount == 0) firstSubId = subId;
                subCount++;
            }
            else if (baseTok == BinXmlToken.Value || baseTok == BinXmlToken.CharRef ||
                     baseTok == BinXmlToken.EntityRef || baseTok == BinXmlToken.CDataSection)
            {
                hasOtherContent = true;
                break;
            }
            else break;
        }

        if (subCount == 1 && !hasOtherContent && valueOffsets != null && firstSubId >= 0 &&
            firstSubId < valueOffsets.Length)
        {
            // Single typed substitution — render as JSON primitive
            byte valType = valueTypes![firstSubId];
            int valSize = valueSizes![firstSubId];

            // Consume the substitution token
            pos++; // token
            pos += 2; // subId
            pos++; // valType

            if (valType == BinXmlValueType.Null || valSize == 0)
            {
                w.WriteNullValue();
                return;
            }

            RenderValueJson(valSize, valType, valueOffsets[firstSubId], binxmlChunkBase, w);
            return;
        }

        // Multiple subs or mixed content — render as concatenated string
        string text = RenderContentToString(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase);
        w.WriteStringValue(text);
    }

    /// <summary>
    /// Renders child elements as JSON properties. Handles duplicate name suffixing and EventData/UserData flattening.
    /// </summary>
    private void RenderChildElementsJson(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, Utf8JsonWriter w, bool isDataContainer)
    {
        Dictionary<string, int>? nameCounts = null;

        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof || baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute) break;

            if (baseTok == BinXmlToken.OpenStartElement)
            {
                // Peek at element name without consuming
                int peekPos = pos;
                peekPos++; // token
                peekPos += 2; // depId
                peekPos += 4; // dataSize
                uint nameOff = MemoryMarshal.Read<uint>(data.Slice(peekPos));

                string childName = ReadName(nameOff);

                // For EventData/UserData container: check for Name= attribute
                if (isDataContainer && childName == "Data")
                {
                    string? namedKey = PeekDataNameAttribute(data, pos, binxmlChunkBase, valueOffsets, valueSizes,
                        valueTypes);
                    if (namedKey != null)
                    {
                        // Named data: <Data Name="Foo">bar</Data> → "Foo": "bar"
                        w.WritePropertyName(namedKey);
                        RenderDataElementValueJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase,
                            w);
                        continue;
                    }
                }

                // Handle duplicate names with _N suffixing
                nameCounts ??= new Dictionary<string, int>();
                if (nameCounts.TryGetValue(childName, out int count))
                {
                    nameCounts[childName] = count + 1;
                    w.WritePropertyName($"{childName}_{count}");
                }
                else
                {
                    nameCounts[childName] = 1;
                    w.WritePropertyName(childName);
                }

                RenderElementJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, w);
            }
            else if (baseTok == BinXmlToken.Value)
            {
                pos++;
                pos++; // value type
                string str = ReadUnicodeTextStringAsString(data, ref pos);
                if (str.Length > 0)
                    w.WriteString("#text", str);
            }
            else if (baseTok == BinXmlToken.NormalSubstitution || baseTok == BinXmlToken.OptionalSubstitution)
            {
                pos++;
                ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                pos += 2;
                pos++; // subValType
                if (valueOffsets != null && subId < valueOffsets.Length)
                {
                    byte valType = valueTypes![subId];
                    int valSize = valueSizes![subId];
                    bool skip = baseTok == BinXmlToken.OptionalSubstitution &&
                                (valType == BinXmlValueType.Null || valSize == 0);
                    if (!skip && valType == BinXmlValueType.BinXml && valSize > 0)
                    {
                        // Embedded BinXml — render inline
                        ReadOnlySpan<byte> embeddedData = _fileData.AsSpan(valueOffsets[subId], valSize);
                        int embeddedChunkBase = valueOffsets[subId] - _chunkFileOffset;
                        int embeddedPos = 0;
                        ParseDocumentJson(embeddedData, ref embeddedPos, embeddedChunkBase, w);
                    }
                    else if (!skip && valSize > 0)
                    {
                        w.WritePropertyName("#text");
                        RenderValueJson(valSize, valType, valueOffsets[subId], binxmlChunkBase, w);
                    }
                }
            }
            else if (baseTok == BinXmlToken.TemplateInstance)
            {
                ParseTemplateInstanceJson(data, ref pos, binxmlChunkBase, w);
            }
            else if (baseTok == BinXmlToken.FragmentHeader)
            {
                ParseFragmentJson(data, ref pos, binxmlChunkBase, w);
            }
            else
            {
                pos++;
            }
        }
    }

    /// <summary>
    /// Peeks at a Data element to check for Name="..." attribute, returns the value or null.
    /// </summary>
    private string? PeekDataNameAttribute(ReadOnlySpan<byte> data, int pos,
        int binxmlChunkBase, int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        if (!hasAttrs) return null;

        pos++; // token
        pos += 2; // depId
        pos += 4; // dataSize
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        // Now at attribute list
        if (pos + 4 > data.Length) return null;
        uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;
        int attrEnd = pos + (int)attrListSize;

        while (pos < attrEnd)
        {
            byte attrTok = data[pos];
            byte attrBase = (byte)(attrTok & ~BinXmlToken.HasMoreDataFlag);
            if (attrBase != BinXmlToken.Attribute) break;

            pos++;
            uint attrNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            if (attrNameOff == (uint)(binxmlChunkBase + pos))
            {
                ushort attrNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
                pos += 10 + attrNameChars * 2;
            }

            string attrName = ReadName(attrNameOff);
            if (attrName == "Name")
            {
                string val =
                    RenderContentToString(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase);
                return val.Length > 0 ? val : null;
            }
            else
            {
                // Skip attribute value content
                SkipContent(data, ref pos, binxmlChunkBase);
            }
        }

        return null;
    }

    /// <summary>
    /// Renders a Data element's text value as JSON, skipping the element structure.
    /// Used for EventData/UserData Name= flattening.
    /// </summary>
    private void RenderDataElementValueJson(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes,
        int binxmlChunkBase, Utf8JsonWriter w)
    {
        byte tok = data[pos];
        bool hasAttrs = (tok & BinXmlToken.HasMoreDataFlag) != 0;
        pos++;
        pos += 2; // depId
        pos += 4; // dataSize
        uint nameOffset = MemoryMarshal.Read<uint>(data.Slice(pos));
        pos += 4;

        if (nameOffset == (uint)(binxmlChunkBase + pos))
        {
            ushort elemNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
            pos += 10 + elemNameChars * 2;
        }

        if (hasAttrs)
        {
            uint attrListSize = MemoryMarshal.Read<uint>(data.Slice(pos));
            pos += 4;
            int attrEnd = pos + (int)attrListSize;
            // Skip attributes (we already peeked Name=)
            while (pos < attrEnd)
            {
                byte attrTok = data[pos];
                byte attrBase = (byte)(attrTok & ~BinXmlToken.HasMoreDataFlag);
                if (attrBase != BinXmlToken.Attribute) break;
                pos++;
                uint attrNameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                pos += 4;
                if (attrNameOff == (uint)(binxmlChunkBase + pos))
                {
                    ushort attrNameChars = MemoryMarshal.Read<ushort>(data.Slice(pos + 6));
                    pos += 10 + attrNameChars * 2;
                }

                SkipContent(data, ref pos, binxmlChunkBase);
            }
        }

        if (pos >= data.Length)
        {
            w.WriteNullValue();
            return;
        }

        byte closeTok = data[pos];
        if (closeTok == BinXmlToken.CloseEmptyElement)
        {
            pos++;
            w.WriteNullValue();
            return;
        }

        if (closeTok == BinXmlToken.CloseStartElement)
        {
            pos++;
            RenderTextContentJson(data, ref pos, valueOffsets, valueSizes, valueTypes, binxmlChunkBase, w);
            if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
                pos++;
        }
        else
        {
            w.WriteNullValue();
        }
    }

    /// <summary>
    /// Renders content tokens as a plain string (for attribute values and text content in JSON mode).
    /// </summary>
    private string RenderContentToString(ReadOnlySpan<byte> data, ref int pos,
        int[]? valueOffsets, int[]? valueSizes, byte[]? valueTypes, int binxmlChunkBase)
    {
        ValueStringBuilder vsb = new(stackalloc char[128]);

        while (pos < data.Length)
        {
            byte tok = data[pos];
            byte baseTok = (byte)(tok & ~BinXmlToken.HasMoreDataFlag);

            if (baseTok == BinXmlToken.Eof ||
                baseTok == BinXmlToken.CloseStartElement ||
                baseTok == BinXmlToken.CloseEmptyElement ||
                baseTok == BinXmlToken.EndElement ||
                baseTok == BinXmlToken.Attribute)
                break;

            switch (baseTok)
            {
                case BinXmlToken.Value:
                    pos++;
                    pos++;
                    vsb.Append(ReadUnicodeTextStringAsString(data, ref pos));
                    break;
                case BinXmlToken.NormalSubstitution:
                {
                    pos++;
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++;
                    if (valueOffsets != null && subId < valueOffsets.Length)
                        RenderValue(valueSizes![subId], valueTypes![subId], valueOffsets[subId], binxmlChunkBase,
                            ref vsb);
                    break;
                }
                case BinXmlToken.OptionalSubstitution:
                {
                    pos++;
                    ushort subId = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    pos++;
                    if (valueOffsets != null && subId < valueOffsets.Length)
                    {
                        byte vt = valueTypes![subId];
                        int vs = valueSizes![subId];
                        if (vt != BinXmlValueType.Null && vs > 0)
                            RenderValue(vs, vt, valueOffsets[subId], binxmlChunkBase, ref vsb);
                    }

                    break;
                }
                case BinXmlToken.CharRef:
                {
                    pos++;
                    ushort charVal = MemoryMarshal.Read<ushort>(data.Slice(pos));
                    pos += 2;
                    vsb.Append((char)charVal);
                    break;
                }
                case BinXmlToken.EntityRef:
                {
                    pos++;
                    uint nameOff = MemoryMarshal.Read<uint>(data.Slice(pos));
                    pos += 4;
                    string entityName = ReadName(nameOff);
                    string resolved = entityName switch
                    {
                        "amp" => "&",
                        "lt" => "<",
                        "gt" => ">",
                        "quot" => "\"",
                        "apos" => "'",
                        _ => $"&{entityName};"
                    };
                    vsb.Append(resolved);
                    break;
                }
                case BinXmlToken.CDataSection:
                    pos++;
                    vsb.Append(ReadUnicodeTextStringAsString(data, ref pos));
                    break;
                default:
                    pos++;
                    break;
            }
        }

        string result = vsb.ToString();
        vsb.Dispose();
        return result;
    }

    private void SkipToEndElement(ReadOnlySpan<byte> data, ref int pos)
    {
        SkipContent(data, ref pos, 0);
        if (pos < data.Length && data[pos] == BinXmlToken.EndElement)
            pos++;
    }

    /// <summary>
    /// Renders a typed value as a JSON value.
    /// </summary>
    private void RenderValueJson(int size, byte valueType, int fileOffset, int binxmlChunkBase, Utf8JsonWriter w)
    {
        if (size == 0)
        {
            w.WriteNullValue();
            return;
        }

        ReadOnlySpan<byte> valueBytes = _fileData.AsSpan(fileOffset, size);

        // Array flag
        if ((valueType & BinXmlValueType.ArrayFlag) != 0)
        {
            RenderArrayJson(valueBytes, (byte)(valueType & 0x7F), fileOffset, binxmlChunkBase, w);
            return;
        }

        switch (valueType)
        {
            case BinXmlValueType.Null:
                w.WriteNullValue();
                break;

            case BinXmlValueType.String:
            {
                ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(valueBytes);
                if (chars.Length > 0 && chars[^1] == '\0')
                    chars = chars[..^1];
                w.WriteStringValue(chars);
                break;
            }

            case BinXmlValueType.AnsiString:
            {
                // Convert byte-by-byte to string
                int len = valueBytes.IndexOf((byte)0);
                if (len < 0) len = valueBytes.Length;
                Span<char> ansiChars = stackalloc char[len];
                for (int i = 0; i < len; i++) ansiChars[i] = (char)valueBytes[i];
                w.WriteStringValue(ansiChars);
                break;
            }

            case BinXmlValueType.Int8:
                w.WriteNumberValue((sbyte)valueBytes[0]);
                break;

            case BinXmlValueType.UInt8:
                w.WriteNumberValue(valueBytes[0]);
                break;

            case BinXmlValueType.Int16:
                w.WriteNumberValue(MemoryMarshal.Read<short>(valueBytes));
                break;

            case BinXmlValueType.UInt16:
                w.WriteNumberValue(MemoryMarshal.Read<ushort>(valueBytes));
                break;

            case BinXmlValueType.Int32:
                w.WriteNumberValue(MemoryMarshal.Read<int>(valueBytes));
                break;

            case BinXmlValueType.UInt32:
                w.WriteNumberValue(MemoryMarshal.Read<uint>(valueBytes));
                break;

            case BinXmlValueType.Int64:
                w.WriteNumberValue(MemoryMarshal.Read<long>(valueBytes));
                break;

            case BinXmlValueType.UInt64:
                w.WriteNumberValue(MemoryMarshal.Read<ulong>(valueBytes));
                break;

            case BinXmlValueType.Float:
                w.WriteNumberValue(MemoryMarshal.Read<float>(valueBytes));
                break;

            case BinXmlValueType.Double:
                w.WriteNumberValue(MemoryMarshal.Read<double>(valueBytes));
                break;

            case BinXmlValueType.Bool:
                w.WriteBooleanValue(MemoryMarshal.Read<uint>(valueBytes) != 0);
                break;

            case BinXmlValueType.Binary:
            {
                ValueStringBuilder vsb = new(stackalloc char[size * 2]);
                AppendHex(ref vsb, valueBytes);
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.Guid:
            {
                if (size < 16)
                {
                    w.WriteNullValue();
                    break;
                }

                ValueStringBuilder vsb = new(stackalloc char[38]);
                RenderGuid(valueBytes, ref vsb);
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.SizeT:
            {
                ValueStringBuilder vsb = new(stackalloc char[18]);
                vsb.Append("0x");
                if (size == 8)
                    vsb.AppendFormatted(MemoryMarshal.Read<ulong>(valueBytes), "x16");
                else
                    vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes), "x8");
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.FileTime:
            {
                if (size < 8)
                {
                    w.WriteNullValue();
                    break;
                }

                long ticks = MemoryMarshal.Read<long>(valueBytes);
                if (ticks == 0)
                {
                    w.WriteStringValue("");
                    break;
                }

                const long FileTimeEpochDelta = 504911232000000000L;
                DateTime dt = new DateTime(ticks + FileTimeEpochDelta, DateTimeKind.Utc);
                ValueStringBuilder vsb = new(stackalloc char[28]);
                vsb.AppendFormatted(dt, "yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'");
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.SystemTime:
            {
                if (size < 16)
                {
                    w.WriteNullValue();
                    break;
                }

                ushort yr = MemoryMarshal.Read<ushort>(valueBytes);
                ushort mo = MemoryMarshal.Read<ushort>(valueBytes.Slice(2));
                ushort dy = MemoryMarshal.Read<ushort>(valueBytes.Slice(6));
                ushort hr = MemoryMarshal.Read<ushort>(valueBytes.Slice(8));
                ushort mn = MemoryMarshal.Read<ushort>(valueBytes.Slice(10));
                ushort sc = MemoryMarshal.Read<ushort>(valueBytes.Slice(12));
                ushort ms = MemoryMarshal.Read<ushort>(valueBytes.Slice(14));
                ValueStringBuilder vsb = new(stackalloc char[24]);
                vsb.AppendFormatted(yr, "D4");
                vsb.Append('-');
                vsb.AppendFormatted(mo, "D2");
                vsb.Append('-');
                vsb.AppendFormatted(dy, "D2");
                vsb.Append('T');
                vsb.AppendFormatted(hr, "D2");
                vsb.Append(':');
                vsb.AppendFormatted(mn, "D2");
                vsb.Append(':');
                vsb.AppendFormatted(sc, "D2");
                vsb.Append('.');
                vsb.AppendFormatted(ms, "D3");
                vsb.Append('Z');
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.Sid:
            {
                if (size < 8)
                {
                    w.WriteNullValue();
                    break;
                }

                ValueStringBuilder vsb = new(stackalloc char[64]);
                byte revision = valueBytes[0];
                byte subCount = valueBytes[1];
                long authority = 0;
                for (int i = 2; i < 8; i++)
                    authority = authority * 256 + valueBytes[i];
                vsb.Append("S-");
                vsb.AppendFormatted(revision);
                vsb.Append('-');
                vsb.AppendFormatted(authority);
                for (int i = 0; i < subCount; i++)
                {
                    int subOff = 8 + i * 4;
                    if (subOff + 4 > size) break;
                    vsb.Append('-');
                    vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes.Slice(subOff)));
                }

                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.HexInt32:
            {
                ValueStringBuilder vsb = new(stackalloc char[10]);
                vsb.Append("0x");
                vsb.AppendFormatted(MemoryMarshal.Read<uint>(valueBytes), "x8");
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.HexInt64:
            {
                ValueStringBuilder vsb = new(stackalloc char[18]);
                vsb.Append("0x");
                vsb.AppendFormatted(MemoryMarshal.Read<ulong>(valueBytes), "x16");
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }

            case BinXmlValueType.BinXml:
            {
                int embeddedChunkBase = fileOffset - _chunkFileOffset;
                int embeddedPos = 0;
                ParseDocumentJson(valueBytes, ref embeddedPos, embeddedChunkBase, w);
                break;
            }

            default:
            {
                ValueStringBuilder vsb = new(stackalloc char[size * 2]);
                AppendHex(ref vsb, valueBytes);
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
                break;
            }
        }
    }

    private void RenderArrayJson(ReadOnlySpan<byte> valueBytes, byte baseType, int fileOffset,
        int binxmlChunkBase, Utf8JsonWriter w)
    {
        w.WriteStartArray();

        if (baseType == BinXmlValueType.String)
        {
            ReadOnlySpan<char> chars = MemoryMarshal.Cast<byte, char>(valueBytes);
            int start = 0;
            for (int i = 0; i <= chars.Length; i++)
            {
                if (i == chars.Length || chars[i] == '\0')
                {
                    if (i > start)
                        w.WriteStringValue(chars.Slice(start, i - start));
                    start = i + 1;
                }
            }
        }
        else
        {
            int elemSize = GetElementSize(baseType);
            if (elemSize > 0 && valueBytes.Length >= elemSize)
            {
                for (int i = 0; i + elemSize <= valueBytes.Length; i += elemSize)
                    RenderValueJson(elemSize, baseType, fileOffset + i, binxmlChunkBase, w);
            }
            else
            {
                ValueStringBuilder vsb = new(stackalloc char[valueBytes.Length * 2]);
                AppendHex(ref vsb, valueBytes);
                w.WriteStringValue(vsb.AsSpan());
                vsb.Dispose();
            }
        }

        w.WriteEndArray();
    }
}