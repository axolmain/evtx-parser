namespace EvtxParserWasm;

/// <summary>
/// Top-level orchestrator. Parses the file header, slices chunks, and collects all parsed data.
/// </summary>
public class EvtxParser
{
    public byte[] RawData { get; }
    public EvtxFileHeader FileHeader { get; }
    public List<EvtxChunk> Chunks { get; }
    public int TotalRecords { get; }

    private EvtxParser(byte[] rawData, EvtxFileHeader fileHeader, List<EvtxChunk> chunks, int totalRecords)
    {
        RawData = rawData;
        FileHeader = fileHeader;
        Chunks = chunks;
        TotalRecords = totalRecords;
    }

    /// <summary>
    /// Parses an entire EVTX file from a byte array.
    /// </summary>
    public static EvtxParser Parse(byte[] data)
    {
        EvtxFileHeader fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);
        int chunkStart = fileHeader.HeaderBlockSize;

        // Compute chunk count from file size — handles files >4GB where ushort maxes at 65535
        int chunkCount = (data.Length - chunkStart) / EvtxChunk.ChunkSize;

        List<EvtxChunk> chunks = new List<EvtxChunk>(chunkCount);
        int totalRecords = 0;

        // Compiled template cache persists across chunks
        Dictionary<Guid, CompiledTemplate?> compiledCache = new();

        // Single span over the whole file — no per-chunk allocations
        ReadOnlySpan<byte> span = data;

        for (int i = 0; i < chunkCount; i++)
        {
            int offset = chunkStart + i * EvtxChunk.ChunkSize;

            // Guard against truncated files
            if (offset + EvtxChunk.ChunkSize > data.Length)
                break;

            // Skip chunks with bad magic (e.g. zeroed-out or corrupted)
            if (!span.Slice(offset, 8).SequenceEqual("ElfChnk\0"u8))
                continue;

            // Slice the span — no 64KB byte[] allocation per chunk
            EvtxChunk chunk = EvtxChunk.Parse(span.Slice(offset, EvtxChunk.ChunkSize), offset, data, compiledCache);
            chunks.Add(chunk);
            totalRecords += chunk.Records.Count;
        }

        return new EvtxParser(data, fileHeader, chunks, totalRecords);
    }
}