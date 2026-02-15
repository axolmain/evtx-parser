using System.Collections.Concurrent;

namespace EvtxParserWasm;

public enum OutputFormat
{
    Xml,
    Json
}

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
    /// maxThreads: 0 or -1 = all cores, 1 = single-threaded, N = use N threads.
    /// </summary>
    public static EvtxParser Parse(byte[] fileData, int maxThreads = 0, OutputFormat format = OutputFormat.Xml)
    {
        EvtxFileHeader fileHeader = EvtxFileHeader.ParseEvtxFileHeader(fileData);
        int chunkStart = fileHeader.HeaderBlockSize;

        // Compute chunk count from file size
        int chunkCount = (fileData.Length - chunkStart) / EvtxChunk.ChunkSize;

        // Phase 1 (sequential): scan chunks, validate magic, collect valid offsets
        ReadOnlySpan<byte> span = fileData;
        int[] validOffsets = new int[chunkCount];
        int validCount = 0;

        for (int i = 0; i < chunkCount; i++)
        {
            int offset = chunkStart + i * EvtxChunk.ChunkSize;
            if (offset + EvtxChunk.ChunkSize > fileData.Length)
                break;
            if (!span.Slice(offset, 8).SequenceEqual("ElfChnk\0"u8))
                continue;
            validOffsets[validCount++] = offset;
        }

        // Phase 2 (parallel): parse all valid chunks
        ConcurrentDictionary<Guid, CompiledTemplate?> compiledCache = new();
        EvtxChunk[] results = new EvtxChunk[validCount];

        int parallelism = maxThreads > 0 ? maxThreads : -1;
        Parallel.For(0, validCount,
            new ParallelOptions { MaxDegreeOfParallelism = parallelism },
            i => { results[i] = EvtxChunk.Parse(fileData, validOffsets[i], compiledCache, format); });

        // Phase 3 (sequential): collect results
        List<EvtxChunk> chunks = new List<EvtxChunk>(validCount);
        int totalRecords = 0;
        for (int i = 0; i < validCount; i++)
        {
            chunks.Add(results[i]);
            totalRecords += results[i].Records.Count;
        }

        return new EvtxParser(fileData, fileHeader, chunks, totalRecords);
    }
}