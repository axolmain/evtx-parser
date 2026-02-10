using System.Text;

namespace CrossPlatEvtxParser.BinXml;

/// <summary>
///     Parses Microsoft Binary XML (BinXml) from EVTX chunks.
///     Binary XML is the encoding used inside EVTX event records.
///     The parser operates on chunk data (byte[]) because template definitions
///     and common strings are stored by offset from chunk start.
/// </summary>
public class BinXmlParser(
    byte[] chunkData,
    Dictionary<uint, BinXmlParser.BinXmlTemplateDefinition>? templateCache = null)
{
    private readonly Dictionary<uint, BinXmlTemplateDefinition> _templateCache = templateCache ?? new Dictionary<uint, BinXmlTemplateDefinition>();
    private int _pos;

    /// <summary>
    ///     Parse binary XML starting at the given offset within chunk data.
    /// </summary>
    public List<BinXmlNode> Parse(int startOffset)
    {
        _pos = startOffset;
        return ParseFragment();
    }

    /// <summary>Parse a complete fragment (sequence of tokens ending with EOF)</summary>
    private List<BinXmlNode> ParseFragment()
    {
        List<BinXmlNode> nodes = new();

        while (_pos < chunkData.Length)
        {
            if (!TryReadByte(out byte tokenByte))
                break;

            BinXmlTokenType token = (BinXmlTokenType)tokenByte;

            if (token == BinXmlTokenType.EOF)
                // EOF token marks end of fragment
                break;

            BinXmlNode? node = ParseToken(token);
            if (node != null)
                nodes.Add(node);
        }

        return nodes;
    }

    /// <summary>Parse a single token and return the corresponding node</summary>
    private BinXmlNode? ParseToken(BinXmlTokenType token)
    {
        switch (token)
        {
            case BinXmlTokenType.FragmentHeader:
                return ParseFragmentHeader();

            case BinXmlTokenType.OpenStartElement:
            case BinXmlTokenType.OpenStartElementAttrs:
                return ParseElement(token == BinXmlTokenType.OpenStartElementAttrs);

            case BinXmlTokenType.CloseStartElement:
                // No data, just marks end of element start section
                return null;

            case BinXmlTokenType.CloseEmptyElement:
                // No data, element is complete
                return null;

            case BinXmlTokenType.EndElement:
                // No data, marks end of element
                return null;

            case BinXmlTokenType.Value:
            case BinXmlTokenType.ValueMore:
                return ParseValue();

            case BinXmlTokenType.Attribute:
            case BinXmlTokenType.AttributeMore:
                return ParseAttribute();

            case BinXmlTokenType.CDataSection:
            case BinXmlTokenType.CDataSectionMore:
                return ParseCData();

            case BinXmlTokenType.CharRef:
            case BinXmlTokenType.CharRefMore:
                return ParseCharRef();

            case BinXmlTokenType.EntityRef:
            case BinXmlTokenType.EntityRefMore:
                return ParseEntityRef();

            case BinXmlTokenType.PITarget:
                return ParsePITarget();

            case BinXmlTokenType.PIData:
                return ParsePIData();

            case BinXmlTokenType.TemplateInstance:
                return ParseTemplateInstance();

            case BinXmlTokenType.NormalSubstitution:
                return ParseSubstitution(false);

            case BinXmlTokenType.OptionalSubstitution:
                return ParseSubstitution(true);

            default:
                throw new InvalidDataException(
                    $"Unknown BinXml token: 0x{(byte)token:X2} at offset {_pos - 1}");
        }
    }

    /// <summary>Parse fragment header (major version, minor version, flags)</summary>
    private BinXmlFragmentHeaderNode ParseFragmentHeader()
    {
        if (!TryReadByte(out byte majorVersion))
            throw new InvalidDataException("Failed to read fragment header major version");

        if (!TryReadByte(out byte minorVersion))
            throw new InvalidDataException("Failed to read fragment header minor version");

        if (!TryReadByte(out byte flags))
            throw new InvalidDataException("Failed to read fragment header flags");

        return new BinXmlFragmentHeaderNode
        {
            TokenType = BinXmlTokenType.FragmentHeader,
            MajorVersion = majorVersion,
            MinorVersion = minorVersion,
            Flags = flags
        };
    }

    /// <summary>Parse element start (with or without attributes)</summary>
    private BinXmlElementNode ParseElement(bool hasAttributes)
    {
        // Dependency ID (2 bytes) - 0xFFFF for no dependency
        if (!TryReadUInt16(out ushort dependencyId))
            throw new InvalidDataException("Failed to read element dependency ID");

        // Data size (4 bytes) - size of name + attrs + content + end tag
        if (!TryReadUInt32(out uint dataSize))
            throw new InvalidDataException("Failed to read element data size");

        // Name offset (4 bytes) - from chunk start
        if (!TryReadUInt32(out uint nameOffset))
            throw new InvalidDataException("Failed to read element name offset");

        // Read the element name from the offset
        string elementName = ReadName(nameOffset);

        BinXmlElementNode element = new()
        {
            TokenType = hasAttributes ? BinXmlTokenType.OpenStartElementAttrs : BinXmlTokenType.OpenStartElement,
            Name = elementName,
            HasAttributes = hasAttributes,
            Attributes = new List<BinXmlAttributeNode>(),
            Children = new List<BinXmlNode>()
        };

        // Parse attributes if present
        while (hasAttributes && _pos < chunkData.Length)
        {
            byte nextTokenByte = chunkData[_pos];
            BinXmlTokenType nextToken = (BinXmlTokenType)nextTokenByte;

            if (nextToken == BinXmlTokenType.Attribute || nextToken == BinXmlTokenType.AttributeMore)
            {
                _pos++; // consume token
                BinXmlAttributeNode? attr = ParseAttributeContent();
                if (attr != null)
                    element.Attributes.Add(attr);
            }
            else
            {
                break;
            }
        }

        // Expect CloseStartElement or CloseEmptyElement after attributes
        if (_pos < chunkData.Length)
        {
            byte closeByte = chunkData[_pos];
            BinXmlTokenType closeToken = (BinXmlTokenType)closeByte;

            if (closeToken == BinXmlTokenType.CloseStartElement)
            {
                _pos++; // consume CloseStartElement
            }
            else if (closeToken == BinXmlTokenType.CloseEmptyElement)
            {
                _pos++; // consume CloseEmptyElement - no children
                return element;
            }
        }

        // Parse children until EndElement
        while (_pos < chunkData.Length)
        {
            byte nextTokenByte = chunkData[_pos];
            BinXmlTokenType nextToken = (BinXmlTokenType)nextTokenByte;

            if (nextToken == BinXmlTokenType.EndElement)
            {
                _pos++; // consume EndElement
                break;
            }

            if (nextToken == BinXmlTokenType.EOF)
                break;

            _pos++; // consume the token byte before calling ParseToken
            BinXmlNode? child = ParseToken(nextToken);
            if (child != null)
                element.Children.Add(child);
        }

        return element;
    }

    /// <summary>Parse attribute (reads name offset only)</summary>
    private BinXmlAttributeNode ParseAttribute()
    {
        // Name offset (4 bytes)
        if (!TryReadUInt32(out uint nameOffset))
            throw new InvalidDataException("Failed to read attribute name offset");

        string attrName = ReadName(nameOffset);

        BinXmlAttributeNode attr = new()
        {
            TokenType = BinXmlTokenType.Attribute,
            Name = attrName,
            Value = null
        };

        // The value follows immediately after the attribute token/name
        // Parse the next token as the attribute value
        if (_pos < chunkData.Length)
        {
            byte nextTokenByte = chunkData[_pos];
            BinXmlTokenType nextToken = (BinXmlTokenType)nextTokenByte;

            if (nextToken == BinXmlTokenType.Value || nextToken == BinXmlTokenType.ValueMore)
            {
                _pos++; // consume token
                attr.Value = ParseValueContent();
            }
        }

        return attr;
    }

    /// <summary>Parse attribute content (called after token is consumed)</summary>
    private BinXmlAttributeNode ParseAttributeContent()
    {
        // Name offset (4 bytes)
        if (!TryReadUInt32(out uint nameOffset))
            throw new InvalidDataException("Failed to read attribute name offset");

        string attrName = ReadName(nameOffset);

        BinXmlAttributeNode attr = new()
        {
            TokenType = BinXmlTokenType.Attribute,
            Name = attrName,
            Value = null
        };

        // The value follows immediately after
        if (_pos < chunkData.Length)
        {
            byte nextTokenByte = chunkData[_pos];
            BinXmlTokenType nextToken = (BinXmlTokenType)nextTokenByte;

            if (nextToken == BinXmlTokenType.Value || nextToken == BinXmlTokenType.ValueMore)
            {
                _pos++; // consume token
                attr.Value = ParseValueContent();
            }
        }

        return attr;
    }

    /// <summary>Parse value token (1 byte type + 2 bytes size + N bytes data)</summary>
    private BinXmlValueNode ParseValue()
    {
        if (!TryReadByte(out byte typeValue))
            throw new InvalidDataException("Failed to read value type");

        BinXmlValueType valueType = (BinXmlValueType)typeValue;

        if (!TryReadUInt16(out ushort dataSize))
            throw new InvalidDataException("Failed to read value data size");

        if (!TryReadBytes(dataSize, out byte[] valueData))
            throw new InvalidDataException($"Failed to read {dataSize} bytes of value data");

        object? deserialized = DeserializeValue(valueType, valueData);

        return new BinXmlValueNode
        {
            TokenType = BinXmlTokenType.Value,
            ValueType = valueType,
            Data = deserialized
        };
    }

    /// <summary>Parse value content (called after token is consumed)</summary>
    private BinXmlValueNode ParseValueContent()
    {
        if (!TryReadByte(out byte typeValue))
            throw new InvalidDataException("Failed to read value type");

        BinXmlValueType valueType = (BinXmlValueType)typeValue;

        if (!TryReadUInt16(out ushort dataSize))
            throw new InvalidDataException("Failed to read value data size");

        if (!TryReadBytes(dataSize, out byte[] valueData))
            throw new InvalidDataException($"Failed to read {dataSize} bytes of value data");

        object? deserialized = DeserializeValue(valueType, valueData);

        return new BinXmlValueNode
        {
            TokenType = BinXmlTokenType.Value,
            ValueType = valueType,
            Data = deserialized
        };
    }

    /// <summary>Parse CDATA section</summary>
    private BinXmlCDataNode ParseCData()
    {
        if (!TryReadUInt16(out ushort dataSize))
            throw new InvalidDataException("Failed to read CDATA data size");

        if (!TryReadBytes(dataSize, out byte[] data))
            throw new InvalidDataException($"Failed to read {dataSize} bytes of CDATA");

        string text = Encoding.Unicode.GetString(data);

        return new BinXmlCDataNode
        {
            TokenType = BinXmlTokenType.CDataSection,
            Text = text
        };
    }

    /// <summary>Parse character reference</summary>
    private BinXmlCharRefNode ParseCharRef()
    {
        if (!TryReadUInt16(out ushort charValue))
            throw new InvalidDataException("Failed to read character reference value");

        return new BinXmlCharRefNode
        {
            TokenType = BinXmlTokenType.CharRef,
            CharValue = charValue
        };
    }

    /// <summary>Parse entity reference</summary>
    private BinXmlEntityRefNode ParseEntityRef()
    {
        if (!TryReadUInt32(out uint nameOffset))
            throw new InvalidDataException("Failed to read entity reference name offset");

        string entityName = ReadName(nameOffset);

        return new BinXmlEntityRefNode
        {
            TokenType = BinXmlTokenType.EntityRef,
            Name = entityName
        };
    }

    /// <summary>Parse processing instruction target</summary>
    private BinXmlProcessingInstructionNode ParsePITarget()
    {
        if (!TryReadUInt32(out uint nameOffset))
            throw new InvalidDataException("Failed to read PI target name offset");

        string target = ReadName(nameOffset);

        BinXmlProcessingInstructionNode pi = new()
        {
            TokenType = BinXmlTokenType.PITarget,
            Target = target,
            Data = string.Empty
        };

        // PI data typically follows in next token
        if (_pos < chunkData.Length)
        {
            byte nextTokenByte = chunkData[_pos];
            BinXmlTokenType nextToken = (BinXmlTokenType)nextTokenByte;

            if (nextToken == BinXmlTokenType.PIData)
            {
                _pos++; // consume token
                if (!TryReadUInt16(out ushort dataSize))
                    throw new InvalidDataException("Failed to read PI data size");

                if (!TryReadBytes(dataSize, out byte[] data))
                    throw new InvalidDataException($"Failed to read {dataSize} bytes of PI data");

                pi.Data = Encoding.Unicode.GetString(data);
            }
        }

        return pi;
    }

    /// <summary>Parse processing instruction data</summary>
    private BinXmlProcessingInstructionNode ParsePIData()
    {
        if (!TryReadUInt16(out ushort dataSize))
            throw new InvalidDataException("Failed to read PI data size");

        if (!TryReadBytes(dataSize, out byte[] data))
            throw new InvalidDataException($"Failed to read {dataSize} bytes of PI data");

        string text = Encoding.Unicode.GetString(data);

        return new BinXmlProcessingInstructionNode
        {
            TokenType = BinXmlTokenType.PIData,
            Target = string.Empty,
            Data = text
        };
    }

    /// <summary>Parse template instance (token 0x0C)</summary>
    /// <remarks>
    ///     Template instance layout:
    ///     1 byte:  unknown (0x01)
    ///     4 bytes: template definition data offset (relative to chunk start)
    ///     Template definition data (at the offset):
    ///     4 bytes: next template definition data offset (0 if none)
    ///     16 bytes: template GUID
    ///     4 bytes: template data size
    ///     N bytes: template content (fragment header + element tree + EOF)
    ///     Substitution instance data (follows inline after template def on first encounter,
    ///     or immediately after instance header on subsequent encounters):
    ///     4 bytes: number of substitution values
    ///     For each: 2 bytes size + 1 byte type
    ///     Then: actual value data bytes
    /// </remarks>
    private BinXmlTemplateInstanceNode ParseTemplateInstance()
    {
        if (!TryReadByte(out byte unknown))
            throw new InvalidDataException("Failed to read template instance unknown byte");

        if (!TryReadUInt32(out uint templateDefOffset))
            throw new InvalidDataException("Failed to read template definition offset");

        // Parse or retrieve template definition
        BinXmlTemplateDefinition templateDef;

        if (_templateCache.TryGetValue(templateDefOffset, out BinXmlTemplateDefinition? cached))
        {
            // Template already cached from a previous record.
            // _pos is already right after the instance header, at the substitution data.
            templateDef = cached;
        }
        else
        {
            // First encounter — template definition is inline in the stream.
            // Jump to templateDefOffset, parse the definition, and advance _pos
            // past the template definition so we land at the substitution data.
            templateDef = ParseTemplateDefinitionInline(templateDefOffset);
            _templateCache[templateDefOffset] = templateDef;
        }

        // Read substitution values (these follow the template def or instance header)
        if (!TryReadUInt32(out uint substitutionCount))
            throw new InvalidDataException("Failed to read substitution count");

        List<TemplateValueDescriptor> substitutionDescriptors = new();

        for (int i = 0; i < substitutionCount; i++)
        {
            if (!TryReadUInt16(out ushort size))
                throw new InvalidDataException($"Failed to read substitution {i} size");

            if (!TryReadByte(out byte typeValue))
                throw new InvalidDataException($"Failed to read substitution {i} type");

            BinXmlValueType valueType = (BinXmlValueType)typeValue;
            substitutionDescriptors.Add(new TemplateValueDescriptor(size, valueType));
        }

        // Read actual substitution value data
        List<BinXmlValueNode> substitutionValues = new();

        foreach (TemplateValueDescriptor desc in substitutionDescriptors)
            if (desc.Size == 0)
            {
                substitutionValues.Add(new BinXmlValueNode
                {
                    TokenType = BinXmlTokenType.Value,
                    ValueType = desc.ValueType,
                    Data = null
                });
            }
            else
            {
                if (!TryReadBytes(desc.Size, out byte[] data))
                    throw new InvalidDataException($"Failed to read {desc.Size} bytes of substitution data");

                object? deserialized = DeserializeValue(desc.ValueType, data);

                substitutionValues.Add(new BinXmlValueNode
                {
                    TokenType = BinXmlTokenType.Value,
                    ValueType = desc.ValueType,
                    Data = deserialized
                });
            }

        BinXmlTemplateInstanceNode instance = new()
        {
            TokenType = BinXmlTokenType.TemplateInstance,
            TemplateGuid = templateDef.TemplateGuid,
            TemplateId = templateDefOffset,
            TemplateElement = null,
            SubstitutionValues = substitutionValues
        };

        // Extract the root element from template nodes
        foreach (BinXmlNode node in templateDef.TemplateNodes)
            if (node is BinXmlElementNode element)
            {
                instance.TemplateElement = element;
                break;
            }

        return instance;
    }

    /// <summary>
    ///     Parse an inline template definition and advance _pos past it.
    ///     Used on first encounter when the template definition data is inline in the stream.
    /// </summary>
    private BinXmlTemplateDefinition ParseTemplateDefinitionInline(uint offset)
    {
        // Jump to the template definition offset within the chunk
        _pos = (int)offset;

        // Next template definition data offset (4 bytes)
        if (!TryReadUInt32(out uint nextTemplateDefOffset))
            throw new InvalidDataException("Failed to read next template definition offset");

        // Template GUID (16 bytes)
        if (!TryReadBytes(16, out byte[] guidBytes))
            throw new InvalidDataException("Failed to read template GUID");

        Guid guid = new(guidBytes);

        // Template data size (4 bytes) — size of the BinXml content that follows
        if (!TryReadUInt32(out uint dataSize))
            throw new InvalidDataException("Failed to read template data size");

        // Parse template content (fragment header + element tree + EOF token)
        // This advances _pos through the template content.
        List<BinXmlNode> templateNodes = ParseFragment();

        // _pos is now past the template definition data, right at the substitution data.
        return new BinXmlTemplateDefinition(guid, dataSize, offset, templateNodes);
    }

    /// <summary>
    ///     Parse a template definition at the given offset WITHOUT advancing the main cursor.
    ///     Used when we need to look up a template from an offset (e.g., for external references).
    /// </summary>
    private BinXmlTemplateDefinition ParseTemplateDefinitionAtOffset(uint offset)
    {
        int savedPos = _pos;
        try
        {
            return ParseTemplateDefinitionInline(offset);
        }
        finally
        {
            _pos = savedPos;
        }
    }

    /// <summary>Parse normal substitution</summary>
    private BinXmlSubstitutionNode ParseSubstitution(bool optional)
    {
        if (!TryReadUInt16(out ushort substitutionId))
            throw new InvalidDataException("Failed to read substitution ID");

        if (!TryReadByte(out byte typeValue))
            throw new InvalidDataException("Failed to read substitution value type");

        BinXmlValueType valueType = (BinXmlValueType)typeValue;

        return new BinXmlSubstitutionNode
        {
            TokenType = optional ? BinXmlTokenType.OptionalSubstitution : BinXmlTokenType.NormalSubstitution,
            SubstitutionId = substitutionId,
            ValueType = valueType,
            IsOptional = optional
        };
    }

    /// <summary>Read a name from chunk data at the given offset</summary>
    private string ReadName(uint offset)
    {
        int savedPos = _pos;

        try
        {
            _pos = (int)offset;

            // Next string offset (4 bytes)
            if (!TryReadUInt32(out uint _))
                throw new InvalidDataException($"Failed to read next string offset at {offset}");

            // Hash (2 bytes)
            if (!TryReadUInt16(out ushort _))
                throw new InvalidDataException($"Failed to read hash at offset {offset}");

            // Character count (2 bytes)
            if (!TryReadUInt16(out ushort charCount))
                throw new InvalidDataException($"Failed to read character count at offset {offset}");

            // UTF-16LE string data
            if (!TryReadBytes(charCount * 2, out byte[] stringBytes))
                throw new InvalidDataException(
                    $"Failed to read {charCount * 2} bytes of string data at offset {offset}");

            string name = Encoding.Unicode.GetString(stringBytes);

            // Skip null terminator (2 bytes)
            _pos += 2;

            return name;
        }
        finally
        {
            _pos = savedPos;
        }
    }

    /// <summary>Deserialize a value based on its type</summary>
    private object? DeserializeValue(BinXmlValueType valueType, byte[] data)
    {
        if (data.Length == 0 && valueType != BinXmlValueType.Null)
            return null;

        BinXmlValueType baseType = valueType.BaseType();
        bool isArray = valueType.IsArray();

        if (isArray) return DeserializeArray(baseType, data);

        return baseType switch
        {
            BinXmlValueType.Null => null,
            BinXmlValueType.String => Encoding.Unicode.GetString(data),
            BinXmlValueType.AnsiString => Encoding.ASCII.GetString(data),
            BinXmlValueType.Int8 => data.Length > 0 ? (sbyte)data[0] : 0,
            BinXmlValueType.UInt8 => data.Length > 0 ? data[0] : 0,
            BinXmlValueType.Int16 => BitConverter.ToInt16(data, 0),
            BinXmlValueType.UInt16 => BitConverter.ToUInt16(data, 0),
            BinXmlValueType.Int32 => BitConverter.ToInt32(data, 0),
            BinXmlValueType.UInt32 => BitConverter.ToUInt32(data, 0),
            BinXmlValueType.Int64 => BitConverter.ToInt64(data, 0),
            BinXmlValueType.UInt64 => BitConverter.ToUInt64(data, 0),
            BinXmlValueType.Real32 => BitConverter.ToSingle(data, 0),
            BinXmlValueType.Real64 => BitConverter.ToDouble(data, 0),
            BinXmlValueType.Bool => BitConverter.ToUInt32(data, 0) != 0,
            BinXmlValueType.Binary => data,
            BinXmlValueType.Guid => new Guid(data),
            BinXmlValueType.SizeT => data.Length switch
            {
                4 => BitConverter.ToUInt32(data, 0),
                8 => BitConverter.ToUInt64(data, 0),
                _ => 0UL
            },
            BinXmlValueType.FileTime => FileTimeToDateTime(BitConverter.ToInt64(data, 0)),
            BinXmlValueType.SystemTime => ParseSystemTime(data),
            BinXmlValueType.Sid => ParseSid(data),
            BinXmlValueType.HexInt32 => "0x" + BitConverter.ToUInt32(data, 0).ToString("X8"),
            BinXmlValueType.HexInt64 => "0x" + BitConverter.ToUInt64(data, 0).ToString("X16"),
            BinXmlValueType.BinXml => ParseNestedBinXml(data),
            BinXmlValueType.EvtHandle => BitConverter.ToUInt64(data, 0),
            BinXmlValueType.EvtXml => Encoding.Unicode.GetString(data),
            _ => data
        };
    }

    /// <summary>Deserialize an array value</summary>
    private object DeserializeArray(BinXmlValueType baseType, byte[] data)
    {
        return baseType switch
        {
            BinXmlValueType.Null => Array.Empty<object>(),
            BinXmlValueType.String => DeserializeStringArray(data),
            BinXmlValueType.AnsiString => DeserializeAnsiStringArray(data),
            BinXmlValueType.Int8 => data.Select(b => unchecked((sbyte)b)).ToArray(),
            BinXmlValueType.UInt8 => data,
            BinXmlValueType.Int16 => DeserializeInt16Array(data),
            BinXmlValueType.UInt16 => DeserializeUInt16Array(data),
            BinXmlValueType.Int32 => DeserializeInt32Array(data),
            BinXmlValueType.UInt32 => DeserializeUInt32Array(data),
            BinXmlValueType.Int64 => DeserializeInt64Array(data),
            BinXmlValueType.UInt64 => DeserializeUInt64Array(data),
            BinXmlValueType.Real32 => DeserializeReal32Array(data),
            BinXmlValueType.Real64 => DeserializeReal64Array(data),
            BinXmlValueType.Bool => DeserializeBoolArray(data),
            BinXmlValueType.Guid => DeserializeGuidArray(data),
            BinXmlValueType.FileTime => DeserializeFileTimeArray(data),
            BinXmlValueType.SystemTime => DeserializeSystemTimeArray(data),
            BinXmlValueType.Sid => DeserializeSidArray(data),
            BinXmlValueType.HexInt32 => DeserializeHexInt32Array(data),
            BinXmlValueType.HexInt64 => DeserializeHexInt64Array(data),
            _ => data
        };
    }

    private string[] DeserializeStringArray(byte[] data)
    {
        List<string> result = new();
        int offset = 0;

        while (offset < data.Length)
        {
            // Read length prefix (2 bytes)
            if (offset + 2 > data.Length)
                break;

            ushort len = BitConverter.ToUInt16(data, offset);
            offset += 2;

            if (offset + len > data.Length)
                break;

            result.Add(Encoding.Unicode.GetString(data, offset, len));
            offset += len;

            // Skip null terminator
            if (offset + 2 <= data.Length)
                offset += 2;
        }

        return result.ToArray();
    }

    private string[] DeserializeAnsiStringArray(byte[] data)
    {
        List<string> result = new();
        int offset = 0;

        while (offset < data.Length)
        {
            if (offset + 2 > data.Length)
                break;

            ushort len = BitConverter.ToUInt16(data, offset);
            offset += 2;

            if (offset + len > data.Length)
                break;

            result.Add(Encoding.ASCII.GetString(data, offset, len));
            offset += len;

            // Skip null terminator
            if (offset + 1 <= data.Length)
                offset += 1;
        }

        return result.ToArray();
    }

    private short[] DeserializeInt16Array(byte[] data)
    {
        short[] result = new short[data.Length / 2];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToInt16(data, i * 2);
        return result;
    }

    private ushort[] DeserializeUInt16Array(byte[] data)
    {
        ushort[] result = new ushort[data.Length / 2];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToUInt16(data, i * 2);
        return result;
    }

    private int[] DeserializeInt32Array(byte[] data)
    {
        int[] result = new int[data.Length / 4];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToInt32(data, i * 4);
        return result;
    }

    private uint[] DeserializeUInt32Array(byte[] data)
    {
        uint[] result = new uint[data.Length / 4];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToUInt32(data, i * 4);
        return result;
    }

    private long[] DeserializeInt64Array(byte[] data)
    {
        long[] result = new long[data.Length / 8];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToInt64(data, i * 8);
        return result;
    }

    private ulong[] DeserializeUInt64Array(byte[] data)
    {
        ulong[] result = new ulong[data.Length / 8];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToUInt64(data, i * 8);
        return result;
    }

    private float[] DeserializeReal32Array(byte[] data)
    {
        float[] result = new float[data.Length / 4];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToSingle(data, i * 4);
        return result;
    }

    private double[] DeserializeReal64Array(byte[] data)
    {
        double[] result = new double[data.Length / 8];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToDouble(data, i * 8);
        return result;
    }

    private bool[] DeserializeBoolArray(byte[] data)
    {
        bool[] result = new bool[data.Length / 4];
        for (int i = 0; i < result.Length; i++)
            result[i] = BitConverter.ToUInt32(data, i * 4) != 0;
        return result;
    }

    private Guid[] DeserializeGuidArray(byte[] data)
    {
        Guid[] result = new Guid[data.Length / 16];
        for (int i = 0; i < result.Length; i++)
            result[i] = new Guid(data.AsSpan(i * 16, 16).ToArray());
        return result;
    }

    private DateTime[] DeserializeFileTimeArray(byte[] data)
    {
        DateTime[] result = new DateTime[data.Length / 8];
        for (int i = 0; i < result.Length; i++)
            result[i] = FileTimeToDateTime(BitConverter.ToInt64(data, i * 8));
        return result;
    }

    private DateTime[] DeserializeSystemTimeArray(byte[] data)
    {
        DateTime[] result = new DateTime[data.Length / 16];
        for (int i = 0; i < result.Length; i++)
            result[i] = ParseSystemTime(data.AsSpan(i * 16, 16).ToArray());
        return result;
    }

    private string[] DeserializeSidArray(byte[] data)
    {
        List<string> result = new();
        int offset = 0;

        while (offset < data.Length)
        {
            // SID length is variable; we parse one at a time
            int sidSize = CalculateSidSize(data, offset);
            if (sidSize <= 0 || offset + sidSize > data.Length)
                break;

            result.Add(ParseSid(data.AsSpan(offset, sidSize).ToArray()));
            offset += sidSize;
        }

        return result.ToArray();
    }

    private string[] DeserializeHexInt32Array(byte[] data)
    {
        string[] result = new string[data.Length / 4];
        for (int i = 0; i < result.Length; i++)
            result[i] = "0x" + BitConverter.ToUInt32(data, i * 4).ToString("X8");
        return result;
    }

    private string[] DeserializeHexInt64Array(byte[] data)
    {
        string[] result = new string[data.Length / 8];
        for (int i = 0; i < result.Length; i++)
            result[i] = "0x" + BitConverter.ToUInt64(data, i * 8).ToString("X16");
        return result;
    }

    /// <summary>Convert Windows FILETIME to DateTime</summary>
    private DateTime FileTimeToDateTime(long filetime)
    {
        try
        {
            return DateTime.FromFileTimeUtc(filetime);
        }
        catch
        {
            return DateTime.MinValue;
        }
    }

    /// <summary>Parse SYSTEMTIME structure (8 uint16 fields)</summary>
    private DateTime ParseSystemTime(byte[] data)
    {
        if (data.Length < 16)
            return DateTime.MinValue;

        ushort year = BitConverter.ToUInt16(data, 0);
        ushort month = BitConverter.ToUInt16(data, 2);
        ushort dayOfWeek = BitConverter.ToUInt16(data, 4); // unused
        ushort day = BitConverter.ToUInt16(data, 6);
        ushort hour = BitConverter.ToUInt16(data, 8);
        ushort minute = BitConverter.ToUInt16(data, 10);
        ushort second = BitConverter.ToUInt16(data, 12);
        ushort millisecond = BitConverter.ToUInt16(data, 14);

        try
        {
            return new DateTime(year, month, day, hour, minute, second, millisecond, DateTimeKind.Utc);
        }
        catch
        {
            return DateTime.MinValue;
        }
    }

    /// <summary>Parse Windows SID to string format "S-1-X-..."</summary>
    private string ParseSid(byte[] data)
    {
        if (data.Length < 8)
            return string.Empty;

        byte revision = data[0];
        byte subAuthCount = data[1];

        // Authority is a 6-byte big-endian value
        ulong authority = 0;
        for (int i = 0; i < 6; i++) authority = (authority << 8) | data[2 + i];

        StringBuilder sb = new();
        sb.Append($"S-{revision}-{authority}");

        // SubAuthorities are 4-byte little-endian values
        int offset = 8;
        for (int i = 0; i < subAuthCount; i++)
        {
            if (offset + 4 > data.Length)
                break;

            uint subAuth = BitConverter.ToUInt32(data, offset);
            sb.Append($"-{subAuth}");
            offset += 4;
        }

        return sb.ToString();
    }

    /// <summary>Calculate the size of a SID in bytes</summary>
    private int CalculateSidSize(byte[] data, int offset)
    {
        if (offset + 2 > data.Length)
            return -1;

        byte subAuthCount = data[offset + 1];
        return 8 + subAuthCount * 4;
    }

    /// <summary>Parse nested BinXml data</summary>
    private List<BinXmlNode> ParseNestedBinXml(byte[] data)
    {
        BinXmlParser nestedParser = new(data, _templateCache);
        return nestedParser.Parse(0);
    }

    /// <summary>Try to read a single byte</summary>
    private bool TryReadByte(out byte value)
    {
        value = 0;
        if (_pos >= chunkData.Length)
            return false;

        value = chunkData[_pos];
        _pos++;
        return true;
    }

    /// <summary>Try to read a uint16 (little-endian)</summary>
    private bool TryReadUInt16(out ushort value)
    {
        value = 0;
        if (_pos + 2 > chunkData.Length)
            return false;

        value = BitConverter.ToUInt16(chunkData, _pos);
        _pos += 2;
        return true;
    }

    /// <summary>Try to read a uint32 (little-endian)</summary>
    private bool TryReadUInt32(out uint value)
    {
        value = 0;
        if (_pos + 4 > chunkData.Length)
            return false;

        value = BitConverter.ToUInt32(chunkData, _pos);
        _pos += 4;
        return true;
    }

    /// <summary>Try to read a specified number of bytes</summary>
    private bool TryReadBytes(int count, out byte[] data)
    {
        data = Array.Empty<byte>();
        if (_pos + count > chunkData.Length)
            return false;

        data = chunkData[_pos..(_pos + count)];
        _pos += count;
        return true;
    }

    /// <summary>Cached template definition with parsed nodes</summary>
    public record BinXmlTemplateDefinition(
        Guid TemplateGuid,
        uint DataSize,
        uint Offset,
        List<BinXmlNode> TemplateNodes
    );

    /// <summary>Template value descriptor for substitution values</summary>
    private record TemplateValueDescriptor(
        ushort Size,
        BinXmlValueType ValueType
    );
}