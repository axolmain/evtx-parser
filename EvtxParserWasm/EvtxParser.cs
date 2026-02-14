namespace EvtxParserWasm;

/// <summary>
/// Top-level orchestrator. Parses the file header, slices chunks, and collects all parsed data.
/// </summary>
public class EvtxParser
{
    public EvtxFileHeader FileHeader { get; }
    public List<EvtxChunk> Chunks { get; }
    public int TotalRecords { get; }

    private EvtxParser(EvtxFileHeader fileHeader, List<EvtxChunk> chunks, int totalRecords)
    {
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
        ushort chunkStart = fileHeader.HeaderBlockSize;

        List<EvtxChunk> chunks = new List<EvtxChunk>(fileHeader.NumberOfChunks);
        int totalRecords = 0;

        // Single span over the whole file — no per-chunk allocations
        ReadOnlySpan<byte> span = data;

        for (int i = 0; i < fileHeader.NumberOfChunks; i++)
        {
            int offset = chunkStart + i * EvtxChunk.ChunkSize;

            // Guard against truncated files
            if (offset + EvtxChunk.ChunkSize > data.Length)
                break;

            // Skip chunks with bad magic (e.g. zeroed-out or corrupted)
            if (!span.Slice(offset, 8).SequenceEqual("ElfChnk\0"u8))
                continue;

            // Slice the span — no 64KB byte[] allocation per chunk
            EvtxChunk chunk = EvtxChunk.Parse(span.Slice(offset, EvtxChunk.ChunkSize));
            chunks.Add(chunk);
            totalRecords += chunk.Records.Count;
        }

        return new EvtxParser(fileHeader, chunks, totalRecords);
    }
}