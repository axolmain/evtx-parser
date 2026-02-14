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
        byte[] data = File.ReadAllBytes(Path.Combine(TestDataDir, filename));
        int offset = FileHeaderSize + chunkIndex * ChunkSize;
        return data[offset..(offset + ChunkSize)];
    }

    [Fact]
    public void PreloadsTemplatesFromFirstChunk()
    {
        byte[] chunkData = GetChunkData("security.evtx");
        EvtxChunkHeader chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

        Stopwatch sw = Stopwatch.StartNew();
        Dictionary<uint, BinXmlTemplateDefinition> cache =
            BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
        sw.Stop();

        Assert.True(cache.Count > 0, "Should find at least one template definition");

        testOutputHelper.WriteLine($"Preloaded {cache.Count} templates in {sw.Elapsed.TotalMicroseconds:F1}µs");
        foreach ((uint offset, BinXmlTemplateDefinition def) in cache)
        {
            testOutputHelper.WriteLine(
                $"  offset={offset}, guid={def.Guid}, dataSize={def.DataSize}, next={def.NextTemplateOffset}");
        }
    }

    [Fact]
    public void TemplateDefinitionsHaveValidData()
    {
        byte[] chunkData = GetChunkData("security.evtx");
        EvtxChunkHeader chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);
        Dictionary<uint, BinXmlTemplateDefinition> cache =
            BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);

        foreach ((uint offset, BinXmlTemplateDefinition def) in cache)
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
        byte[] data = File.ReadAllBytes(Path.Combine(TestDataDir, "security.evtx"));
        EvtxFileHeader fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);

        int totalTemplates = 0;
        int chainedTemplates = 0;

        for (int ci = 0; ci < fileHeader.NumberOfChunks; ci++)
        {
            int offset = FileHeaderSize + ci * ChunkSize;
            byte[] chunkData = data[offset..(offset + ChunkSize)];
            EvtxChunkHeader chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

            // Count direct pointers (non-zero entries in table)
            int directPtrs = chunkHeader.TemplatePtrs.Count(p => p != 0);

            Dictionary<uint, BinXmlTemplateDefinition> cache =
                BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
            totalTemplates += cache.Count;
            chainedTemplates += cache.Count - directPtrs;
        }

        testOutputHelper.WriteLine($"Total templates: {totalTemplates}, found via chaining: {chainedTemplates}");
    }

    [Fact]
    public void PreloadsFromAllTestFiles()
    {
        string[] evtxFiles = Directory.GetFiles(TestDataDir, "*.evtx");
        Stopwatch sw = new Stopwatch();

        foreach (string file in evtxFiles)
        {
            byte[] data = File.ReadAllBytes(file);
            EvtxFileHeader fileHeader = EvtxFileHeader.ParseEvtxFileHeader(data);
            string name = Path.GetFileName(file);
            int totalTemplates = 0;
            double totalUs = 0;

            for (int ci = 0; ci < fileHeader.NumberOfChunks; ci++)
            {
                int offset = FileHeaderSize + ci * ChunkSize;
                if (offset + ChunkSize > data.Length) break;

                byte[] chunkData = data[offset..(offset + ChunkSize)];
                if (!chunkData.AsSpan()[..8].SequenceEqual("ElfChnk\0"u8)) continue;

                EvtxChunkHeader chunkHeader = EvtxChunkHeader.ParseEvtxChunkHeader(chunkData);

                sw.Restart();
                Dictionary<uint, BinXmlTemplateDefinition> cache =
                    BinXmlTemplateDefinition.PreloadFromChunk(chunkData, chunkHeader.TemplatePtrs);
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
        byte[] chunkData = new byte[ChunkSize];
        uint[] emptyPtrs = new uint[32];

        Dictionary<uint, BinXmlTemplateDefinition> cache =
            BinXmlTemplateDefinition.PreloadFromChunk(chunkData, emptyPtrs);

        Assert.Empty(cache);
    }

    [Fact]
    public void HandlesOutOfBoundsPointer()
    {
        byte[] chunkData = new byte[ChunkSize];
        uint[] badPtrs = new uint[32];
        badPtrs[0] = 99999; // beyond chunk boundary

        Dictionary<uint, BinXmlTemplateDefinition>
            cache = BinXmlTemplateDefinition.PreloadFromChunk(chunkData, badPtrs);

        Assert.Empty(cache);
    }
}