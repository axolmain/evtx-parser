using System.Runtime.InteropServices;

namespace EvtxParserWasm;

/// <summary>
/// Raw template definition header for zero-copy reads via MemoryMarshal.
/// Matches the on-disk little-endian layout at each template pointer location.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
internal readonly struct TemplateHeaderLayout
{
    public readonly uint NextTemplateOffset; // 0: next in hash chain, 0 if end
    public readonly Guid Guid; // 4: template identifier
    public readonly uint DataSize; // 20: size of template body
}

/// <summary>
/// A template definition as stored in the chunk, pointed to by the template pointer table.
/// The pointer table is a 32-entry chained hash table at chunk offset 384. Each entry is the
/// head of a linked list — follow NextTemplateOffset to find additional definitions in the
/// same hash bucket.
/// </summary>
/// <param name="DefDataOffset">Chunk-relative offset where this definition lives. Used as the cache key.</param>
/// <param name="NextTemplateOffset">Offset 0, 4 bytes — Next template definition offset in hash chain. 0 if end of chain.</param>
/// <param name="Guid">Offset 4, 16 bytes — Template identifier GUID.</param>
/// <param name="DataSize">Offset 20, 4 bytes — Size of the template body (fragment header + element tree + EOF token).</param>
/// <param name="Data">Offset 24, variable — Raw template body bytes.</param>
public record BinXmlTemplateDefinition(
    uint DefDataOffset,
    uint NextTemplateOffset,
    Guid Guid,
    uint DataSize,
    byte[] Data)
{
    /// <summary>
    /// Parses a template definition from chunk data at the given chunk-relative offset.
    /// </summary>
    public static BinXmlTemplateDefinition ParseAt(ReadOnlySpan<byte> chunkData, uint offset)
    {
        TemplateHeaderLayout header = MemoryMarshal.Read<TemplateHeaderLayout>(chunkData[(int)offset..]);
        byte[] body = chunkData.Slice((int)offset + 24, (int)header.DataSize).ToArray();

        return new BinXmlTemplateDefinition(
            DefDataOffset: offset,
            NextTemplateOffset: header.NextTemplateOffset,
            Guid: header.Guid,
            DataSize: header.DataSize,
            Data: body
        );
    }

    /// <summary>
    /// Preloads all template definitions from a chunk's template pointer table,
    /// following hash chains. Returns a dictionary keyed by chunk-relative offset.
    /// </summary>
    public static Dictionary<uint, BinXmlTemplateDefinition> PreloadFromChunk(
        ReadOnlySpan<byte> chunkData, uint[] templatePtrs)
    {
        Dictionary<uint, BinXmlTemplateDefinition> cache = new Dictionary<uint, BinXmlTemplateDefinition>();

        for (int i = 0; i < templatePtrs.Length; i++)
        {
            uint tplOffset = templatePtrs[i];

            while (tplOffset != 0)
            {
                if (cache.ContainsKey(tplOffset)) break; // already cached

                if (tplOffset + 24 > chunkData.Length) break; // bounds check

                BinXmlTemplateDefinition def = ParseAt(chunkData, tplOffset);
                cache[tplOffset] = def;

                tplOffset = def.NextTemplateOffset;
            }
        }

        return cache;
    }
}