using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace EvtxParserWasm;

[Flags]
public enum ChunkFlags : uint
{
    None = 0x0,
    Dirty = 0x1,
    NoCrc32 = 0x4,
}

/// <summary>
/// The file body consists of sequentially laid-out chunks, each exactly 64 KB. Each chunk is a self-contained unit with
/// its own header, a sequence of event records encoded in Binary XML, and trailing unused space. Chunks maintain their
/// own string and template caches for deduplication within the chunk boundary. The chunk header includes CRC32
/// checksums for both the header and the event record data area.
/// </summary>
public class EvtxChunk
{
    public const int ChunkSize = 65536;
    private const int ChunkHeaderSize = 512;

    public EvtxChunkHeader Header { get; }
    public Dictionary<uint, BinXmlTemplateDefinition> Templates { get; }
    public List<EvtxRecord> Records { get; }
    public string[] ParsedXml { get; }
    public byte[][]? ParsedJson { get; }

    private EvtxChunk(EvtxChunkHeader header, Dictionary<uint, BinXmlTemplateDefinition> templates,
        List<EvtxRecord> records, string[] parsedXml, byte[][]? parsedJson = null)
    {
        Header = header;
        Templates = templates;
        Records = records;
        ParsedXml = parsedXml;
        ParsedJson = parsedJson;
    }

    /// <summary>
    /// Parses a 64KB chunk: header, preloads templates, walks event records, and parses BinXml.
    /// </summary>
    internal static EvtxChunk Parse(ReadOnlySpan<byte> chunkData, int chunkFileOffset,
        byte[] fileData, ConcurrentDictionary<Guid, CompiledTemplate?> compiledCache,
        OutputFormat format = OutputFormat.Xml)
    {
        EvtxChunkHeader header = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        // Read template ptrs inline from the chunk span — no array allocation
        Dictionary<uint, BinXmlTemplateDefinition> templates =
            BinXmlTemplateDefinition.PreloadFromChunk(chunkData,
                MemoryMarshal.Cast<byte, uint>(chunkData.Slice(384, 128)), chunkFileOffset);

        // Clamp free space offset to chunk boundary for resilience against corrupted headers
        uint freeSpaceEnd = Math.Min(header.FreeSpaceOffset, (uint)chunkData.Length);

        // Pre-size from header record count
        int expectedRecords = (int)(header.LastEventRecordId - header.FirstEventRecordId + 1);
        List<EvtxRecord> records = new List<EvtxRecord>(expectedRecords);

        int offset = ChunkHeaderSize;

        while (offset + 28 <= freeSpaceEnd)
        {
            // Check for record magic — only place we check, ParseEvtxRecord skips it
            if (!chunkData.Slice(offset, 4).SequenceEqual("\x2a\x2a\x00\x00"u8))
                break;

            EvtxRecord? record = EvtxRecord.ParseEvtxRecord(chunkData[offset..], chunkFileOffset + offset);

            // TODO: Should we leave this as `break` or `continue` and log it?
            if (record == null) break;
            records.Add(record.Value);
            offset += (int)record.Value.Size;
        }

        // Parse BinXml for each record
        BinXmlParser binXml = new(fileData, chunkFileOffset, templates, compiledCache);

        if (format == OutputFormat.Json)
        {
            byte[][] parsedJson = new byte[records.Count][];
            for (int i = 0; i < records.Count; i++)
                parsedJson[i] = binXml.ParseRecordJson(records[i]);
            return new EvtxChunk(header, templates, records, Array.Empty<string>(), parsedJson);
        }

        string[] parsedXml = new string[records.Count];
        for (int i = 0; i < records.Count; i++)
            parsedXml[i] = binXml.ParseRecord(records[i]);
        return new EvtxChunk(header, templates, records, parsedXml);
    }

    /// <summary>
    /// Parses a 64KB chunk without BinXml parsing (header + templates + records only).
    /// </summary>
    public static EvtxChunk Parse(ReadOnlySpan<byte> chunkData, int chunkFileOffset)
    {
        EvtxChunkHeader header = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        Dictionary<uint, BinXmlTemplateDefinition> templates =
            BinXmlTemplateDefinition.PreloadFromChunk(chunkData,
                MemoryMarshal.Cast<byte, uint>(chunkData.Slice(384, 128)), chunkFileOffset);

        uint freeSpaceEnd = Math.Min(header.FreeSpaceOffset, (uint)chunkData.Length);
        int expectedRecords = (int)(header.LastEventRecordId - header.FirstEventRecordId + 1);
        List<EvtxRecord> records = new List<EvtxRecord>(expectedRecords);

        int offset = ChunkHeaderSize;
        while (offset + 28 <= freeSpaceEnd)
        {
            if (!chunkData.Slice(offset, 4).SequenceEqual("\x2a\x2a\x00\x00"u8))
                break;
            EvtxRecord? record = EvtxRecord.ParseEvtxRecord(chunkData[offset..], chunkFileOffset + offset);
            if (record == null) break;
            records.Add(record.Value);
            offset += (int)record.Value.Size;
        }

        return new EvtxChunk(header, templates, records, Array.Empty<string>());
    }

    /// <summary>
    /// Parses a 64KB chunk from a byte[] — safe for use from Parallel.For lambdas
    /// (ReadOnlySpan is a ref struct and cannot cross thread boundaries).
    /// </summary>
    internal static EvtxChunk Parse(byte[] fileData, int chunkFileOffset,
        ConcurrentDictionary<Guid, CompiledTemplate?> compiledCache,
        OutputFormat format = OutputFormat.Xml)
    {
        ReadOnlySpan<byte> chunkData = fileData.AsSpan(chunkFileOffset, ChunkSize);
        return Parse(chunkData, chunkFileOffset, fileData, compiledCache, format);
    }
}