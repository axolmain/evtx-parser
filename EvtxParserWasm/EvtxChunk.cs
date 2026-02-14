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

    private EvtxChunk(EvtxChunkHeader header, Dictionary<uint, BinXmlTemplateDefinition> templates,
        List<EvtxRecord> records)
    {
        Header = header;
        Templates = templates;
        Records = records;
    }

    /// <summary>
    /// Parses a 64KB chunk: header, preloads templates, then walks all event records.
    /// </summary>
    public static EvtxChunk Parse(ReadOnlySpan<byte> chunkData, int chunkFileOffset)
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

        return new EvtxChunk(header, templates, records);
    }
}