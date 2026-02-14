using System.Diagnostics;

namespace EvtxParserWasm.Tests;

public class EvtxChunkHeaderTests(ITestOutputHelper testOutputHelper)
{
    private static readonly string TestDataDir = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "test", "data"));

    private const int FileHeaderSize = 4096;
    private const int ChunkSize = 65536;

    [Fact]
    public void ParsesFirstChunkOfSecurityEvtx()
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var chunkData = data[FileHeaderSize..(FileHeaderSize + ChunkSize)];

        var sw = Stopwatch.StartNew();
        var chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);
        sw.Stop();

        Assert.Equal("ElfChnk\0"u8.ToArray(), chunk.Signature);
        Assert.Equal(128u, chunk.HeaderSize);
        Assert.True(chunk.LastEventRecordNumber >= chunk.FirstEventRecordNumber);
        Assert.True(chunk.LastEventRecordId >= chunk.FirstEventRecordId);
        Assert.True(chunk.FreeSpaceOffset > 0);
        Assert.True(chunk.Checksum != 0);
        Assert.Equal(64, chunk.CommonStringOffsets.Length);
        Assert.Equal(32, chunk.TemplatePtrs.Length);

        testOutputHelper.WriteLine($"[security.evtx chunk 0] Parsed in {sw.Elapsed.TotalMicroseconds:F1}µs");
        testOutputHelper.WriteLine($"  Records: {chunk.FirstEventRecordNumber}–{chunk.LastEventRecordNumber}");
        testOutputHelper.WriteLine($"  IDs: {chunk.FirstEventRecordId}–{chunk.LastEventRecordId}");
        testOutputHelper.WriteLine($"  FreeSpace: {chunk.FreeSpaceOffset}, Flags: {chunk.Flags}");
    }

    [Fact]
    public void ThrowsOnTruncatedData()
    {
        var data = new byte[256];
        Assert.Throws<InvalidDataException>(() => EvtxChunkHeader.ParseEvtxChunkHeader(data));
    }

    [Fact]
    public void ThrowsOnBadSignature()
    {
        var data = new byte[512];
        Assert.Throws<InvalidDataException>(() => EvtxChunkHeader.ParseEvtxChunkHeader(data));
    }

    [Fact]
    public void ParsesAllChunksInSecurityEvtx()
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);
        var sw = new Stopwatch();

        testOutputHelper.WriteLine($"Parsing {fileHeader.NumberOfChunks} chunks:");

        for (int i = 0; i < fileHeader.NumberOfChunks; i++)
        {
            int offset = FileHeaderSize + i * ChunkSize;
            var chunkData = data[offset..(offset + ChunkSize)];

            sw.Restart();
            var chunk = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);
            sw.Stop();

            testOutputHelper.WriteLine(
                $"  [chunk {i}] {sw.Elapsed.TotalMicroseconds,8:F1}µs | records {chunk.FirstEventRecordNumber}–{chunk.LastEventRecordNumber} | flags {chunk.Flags}");
        }
    }
}