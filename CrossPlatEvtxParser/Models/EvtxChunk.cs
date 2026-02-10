namespace CrossPlatEvtxParser.Models;

/// <summary>
///     Represents a complete 64KB chunk containing a header and event records.
/// </summary>
public class EvtxChunk
{
    public int ChunkIndex { get; set; }
    public EvtxChunkHeader Header { get; set; } = new();
    public List<EvtxEventRecord> EventRecords { get; set; } = new();

    /// <summary>Raw chunk data for checksum validation and binary XML offset resolution</summary>
    public byte[] RawData { get; set; } = Array.Empty<byte>();

    public bool IsValid => Header.HasValidSignature();
    public int EventCount => EventRecords.Count;

    public override string ToString()
    {
        return $"Chunk[{ChunkIndex}] | {EventCount} records | {Header}";
    }
}