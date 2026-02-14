using System.Diagnostics;

namespace EvtxParserWasm.Tests;

public class EvtxRecordTests(ITestOutputHelper testOutputHelper)
{
    private static readonly string TestDataDir = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "test", "data"));

    private const int FileHeaderSize = 4096;
    private const int ChunkSize = 65536;
    private const int ChunkHeaderSize = 512;

    [Fact]
    public void ParsesFirstRecordOfSecurityEvtx()
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var chunkStart = FileHeaderSize;
        var chunkData = data[chunkStart..(chunkStart + ChunkSize)];
        var chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        // First record starts right after chunk header (offset 512 within the chunk)
        var recordData = chunkData[ChunkHeaderSize..];

        var sw = Stopwatch.StartNew();
        var record = EvtxRecord.ParseEvtxRecord(recordData);
        sw.Stop();

        Assert.True(record.Size > 28, "Record size must be larger than the fixed header");
        Assert.Equal(record.Size, record.SizeCopy);
        Assert.Equal(chunk.FirstEventRecordId, record.EventRecordId);
        Assert.True(record.WrittenTime > 0);
        Assert.True(record.EventData.Length > 0);
        Assert.Equal((int)(record.Size - 28), record.EventData.Length);

        testOutputHelper.WriteLine($"[security.evtx record 0] Parsed in {sw.Elapsed.TotalMicroseconds:F1}µs");
        testOutputHelper.WriteLine(
            $"  Size: {record.Size}, RecordId: {record.EventRecordId}, EventData: {record.EventData.Length} bytes");
    }

    [Fact]
    public void ThrowsOnBadSignature()
    {
        var data = new byte[64];
        Assert.Throws<InvalidDataException>(() => EvtxRecord.ParseEvtxRecord(data));
    }

    [Fact]
    public void SizeAndSizeCopyMatch()
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var chunkData = data[FileHeaderSize..(FileHeaderSize + ChunkSize)];

        var offset = ChunkHeaderSize;
        var count = 0;

        while (offset < ChunkSize - 28)
        {
            var recordSlice = chunkData[offset..];
            // Check for record magic before parsing
            if (recordSlice[0] != 0x2a || recordSlice[1] != 0x2a || recordSlice[2] != 0x00 || recordSlice[3] != 0x00)
                break;

            var record = EvtxRecord.ParseEvtxRecord(recordSlice);
            Assert.Equal(record.Size, record.SizeCopy);
            offset += (int)record.Size;
            count++;
        }

        Assert.True(count > 0, "Should have parsed at least one record");
        testOutputHelper.WriteLine($"[security.evtx chunk 0] Validated Size==SizeCopy for {count} records");
    }

    [Fact]
    public void ParsesAllRecordsInFirstChunk()
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var chunkData = data[FileHeaderSize..(FileHeaderSize + ChunkSize)];
        var chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        var sw = new Stopwatch();
        var offset = ChunkHeaderSize;
        var records = new List<EvtxRecord>();

        while (offset < ChunkSize - 28)
        {
            var recordSlice = chunkData[offset..];
            if (recordSlice[0] != 0x2a || recordSlice[1] != 0x2a || recordSlice[2] != 0x00 || recordSlice[3] != 0x00)
                break;

            sw.Start();
            var record = EvtxRecord.ParseEvtxRecord(recordSlice);
            sw.Stop();

            records.Add(record);
            offset += (int)record.Size;
        }

        Assert.True(records.Count > 0);
        // Record IDs should be sequential
        for (int i = 1; i < records.Count; i++)
            Assert.Equal(records[i - 1].EventRecordId + 1, records[i].EventRecordId);

        testOutputHelper.WriteLine(
            $"[security.evtx chunk 0] Parsed {records.Count} records in {sw.Elapsed.TotalMicroseconds:F1}µs total");
        testOutputHelper.WriteLine($"  IDs: {records[0].EventRecordId}–{records[^1].EventRecordId}");
        testOutputHelper.WriteLine($"  Avg: {sw.Elapsed.TotalMicroseconds / records.Count:F2}µs/record");
    }
}