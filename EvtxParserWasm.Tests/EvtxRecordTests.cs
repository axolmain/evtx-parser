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
        byte[] data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        int chunkStart = FileHeaderSize;
        byte[] chunkData = data[chunkStart..(chunkStart + ChunkSize)];
        EvtxChunkHeader chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        byte[] recordData = chunkData[ChunkHeaderSize..];

        Stopwatch sw = Stopwatch.StartNew();
        EvtxRecord? record = EvtxRecord.ParseEvtxRecord(recordData);
        sw.Stop();

        Assert.NotNull(record);
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
    public void ReturnsNullOnInvalidSize()
    {
        byte[] data = new byte[64];
        Assert.Null(EvtxRecord.ParseEvtxRecord(data));
    }

    [Fact]
    public void SizeAndSizeCopyMatch()
    {
        byte[] data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        byte[] chunkData = data[FileHeaderSize..(FileHeaderSize + ChunkSize)];

        int offset = ChunkHeaderSize;
        int count = 0;

        while (offset < ChunkSize - 28)
        {
            ReadOnlySpan<byte> recordSlice = chunkData.AsSpan(offset);
            if (!recordSlice[..4].SequenceEqual("\x2a\x2a\x00\x00"u8))
                break;

            EvtxRecord? record = EvtxRecord.ParseEvtxRecord(recordSlice);
            Assert.NotNull(record);
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
        byte[] data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        byte[] chunkData = data[FileHeaderSize..(FileHeaderSize + ChunkSize)];
        EvtxChunkHeader chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        Stopwatch sw = new Stopwatch();
        int offset = ChunkHeaderSize;
        List<EvtxRecord> records = new List<EvtxRecord>();

        ReadOnlySpan<byte> span = chunkData;
        while (offset < ChunkSize - 28)
        {
            if (!span.Slice(offset, 4).SequenceEqual("\x2a\x2a\x00\x00"u8))
                break;

            sw.Start();
            EvtxRecord? record = EvtxRecord.ParseEvtxRecord(span[offset..]);
            sw.Stop();

            Assert.NotNull(record);
            records.Add(record);
            offset += (int)record.Size;
        }

        Assert.True(records.Count > 0);
        for (int i = 1; i < records.Count; i++)
            Assert.Equal(records[i - 1].EventRecordId + 1, records[i].EventRecordId);

        testOutputHelper.WriteLine(
            $"[security.evtx chunk 0] Parsed {records.Count} records in {sw.Elapsed.TotalMicroseconds:F1}µs total");
        testOutputHelper.WriteLine($"  IDs: {records[0].EventRecordId}–{records[^1].EventRecordId}");
        testOutputHelper.WriteLine($"  Avg: {sw.Elapsed.TotalMicroseconds / records.Count:F2}µs/record");
    }
}