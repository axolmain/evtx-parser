using System.Diagnostics;

namespace EvtxParserWasm.Tests;

public class BinXmlTemplateDefinitionTests(ITestOutputHelper testOutputHelper)
{
    private static readonly string TestDataDir = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "test", "data"));

    private const int FileHeaderSize = 4096;
    private const int ChunkSize = 65536;

    private static byte[] GetChunkData(string filename, int chunkIndex = 0)
    {
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, filename));
        var offset = FileHeaderSize + chunkIndex * ChunkSize;
        return data[offset..(offset + ChunkSize)];
    }

    [Fact]
    public void PreloadsTemplatesFromFirstChunk()
    {
        var chunkData = GetChunkData("security.evtx");
        var chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        var sw = Stopwatch.StartNew();
        var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
        sw.Stop();

        Assert.True(cache.Count > 0, "Should find at least one template definition");

        testOutputHelper.WriteLine($"Preloaded {cache.Count} templates in {sw.Elapsed.TotalMicroseconds:F1}µs");
        foreach (var (offset, def) in cache)
        {
            testOutputHelper.WriteLine(
                $"  offset={offset}, guid={def.Guid}, dataSize={def.DataSize}, next={def.NextTemplateOffset}");
        }
    }

    [Fact]
    public void TemplateDefinitionsHaveValidData()
    {
        var chunkData = GetChunkData("security.evtx");
        var chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);
        var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);

        foreach (var (offset, def) in cache)
        {
            Assert.Equal(offset, def.DefDataOffset);
            Assert.NotEqual(Guid.Empty, def.Guid);
            Assert.True(def.DataSize > 0, $"Template at offset {offset} has zero DataSize");
            Assert.Equal((int)def.DataSize, def.Data.Length);
            // Template body should start with 0x0F (FragmentHeader token)
            Assert.Equal(0x0F, def.Data[0]);
        }
    }

    [Fact]
    public void FollowsHashChains()
    {
        // Parse all chunks and count templates that were found via chaining (not direct pointer)
        var data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        var fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);

        int totalTemplates = 0;
        int chainedTemplates = 0;

        for (int ci = 0; ci < fileHeader.NumberOfChunks; ci++)
        {
            var offset = FileHeaderSize + ci * ChunkSize;
            var chunkData = data[offset..(offset + ChunkSize)];
            var chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

            // Count direct pointers (non-zero entries in table)
            int directPtrs = chunkHeader.TemplatePtrs.Count(p => p != 0);

            var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
            totalTemplates += cache.Count;
            chainedTemplates += cache.Count - directPtrs;
        }

        testOutputHelper.WriteLine($"Total templates: {totalTemplates}, found via chaining: {chainedTemplates}");
    }

    [Fact]
    public void PreloadsFromAllTestFiles()
    {
        var evtxFiles = Directory.GetFiles(TestDataDir, "*.evtx");
        var sw = new Stopwatch();

        foreach (var file in evtxFiles)
        {
            var data = File.ReadAllBytes(file);
            var fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);
            var name = Path.GetFileName(file);
            int totalTemplates = 0;
            double totalUs = 0;

            for (int ci = 0; ci < fileHeader.NumberOfChunks; ci++)
            {
                var offset = FileHeaderSize + ci * ChunkSize;
                if (offset + ChunkSize > data.Length) break;

                var chunkData = data[offset..(offset + ChunkSize)];
                if (!chunkData.AsSpan()[..8].SequenceEqual("ElfChnk\0"u8)) continue;

                var chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

                sw.Restart();
                var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
                sw.Stop();

                totalTemplates += cache.Count;
                totalUs += sw.Elapsed.TotalMicroseconds;
            }

            testOutputHelper.WriteLine(
                $"  [{name}] {fileHeader.NumberOfChunks} chunks, {totalTemplates} templates, {totalUs:F1}µs total");
        }
    }

    [Fact]
    public void HandlesEmptyPointerTable()
    {
        var chunkData = new byte[ChunkSize];
        var emptyPtrs = new uint[32];

        var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, emptyPtrs);

        Assert.Empty(cache);
    }

    [Fact]
    public void HandlesOutOfBoundsPointer()
    {
        var chunkData = new byte[ChunkSize];
        var badPtrs = new uint[32];
        badPtrs[0] = 99999; // beyond chunk boundary

        var cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, badPtrs);

        Assert.Empty(cache);
    }
}