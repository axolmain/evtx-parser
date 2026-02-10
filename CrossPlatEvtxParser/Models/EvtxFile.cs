namespace CrossPlatEvtxParser.Models;

/// <summary>
///     Top-level container representing an entire EVTX file.
/// </summary>
public class EvtxFile
{
    public string FilePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public EvtxFileHeader Header { get; set; } = new();
    public List<EvtxChunk> Chunks { get; set; } = new();

    public int TotalRecordCount => Chunks.Sum(c => c.EventCount);
    public bool IsValid => Header.HasValidSignature();

    public IEnumerable<EvtxEventRecord> EnumerateRecords()
    {
        foreach (EvtxChunk chunk in Chunks)
        foreach (EvtxEventRecord record in chunk.EventRecords)
            yield return record;
    }

    public override string ToString()
    {
        return $"EVTX: {Path.GetFileName(FilePath)} | {FileSize:N0} bytes | " +
               $"{Chunks.Count} chunks | {TotalRecordCount} records | {Header}";
    }
}