namespace CrossPlatEvtxParser.Models;

/// <summary>
///     Represents the 4096-byte EVTX file header.
///     Signature: "ElfFile\0" (8 bytes)
/// </summary>
public class EvtxFileHeader
{
    public const int HeaderBlockSize = 4096;
    public const int HeaderDataSize = 128;
    public static readonly byte[] ExpectedSignature = "ElfFile\0"u8.ToArray();

    /// <summary>Offset 0, 8 bytes: "ElfFile\0"</summary>
    public byte[] Signature { get; set; } = new byte[8];

    /// <summary>Offset 8, 8 bytes: oldest chunk number</summary>
    public ulong FirstChunkNumber { get; set; }

    /// <summary>Offset 16, 8 bytes: newest chunk number</summary>
    public ulong LastChunkNumber { get; set; }

    /// <summary>Offset 24, 8 bytes: next record identifier to assign</summary>
    public ulong NextRecordId { get; set; }

    /// <summary>Offset 32, 4 bytes: always 128</summary>
    public uint HeaderSize { get; set; }

    /// <summary>Offset 36, 2 bytes</summary>
    public ushort MinorVersion { get; set; }

    /// <summary>Offset 38, 2 bytes</summary>
    public ushort MajorVersion { get; set; }

    /// <summary>Offset 40, 2 bytes: always 4096</summary>
    public ushort HeaderBlockSizeField { get; set; }

    /// <summary>Offset 42, 2 bytes</summary>
    public ushort ChunkCount { get; set; }

    // Offset 44: 76 bytes unknown/empty

    /// <summary>Offset 120, 4 bytes: bit flags</summary>
    public uint FileFlags { get; set; }

    /// <summary>Offset 124, 4 bytes: CRC32 of first 120 bytes</summary>
    public uint Checksum { get; set; }

    // Offset 128: 3968 bytes unknown/empty

    public bool IsDirty => (FileFlags & 0x0001) != 0;
    public bool IsFull => (FileFlags & 0x0002) != 0;

    public bool HasValidSignature()
    {
        return Signature.AsSpan().SequenceEqual(ExpectedSignature);
    }

    public override string ToString()
    {
        return $"EVTX v{MajorVersion}.{MinorVersion} | Chunks: {ChunkCount} | " +
               $"Records: {FirstChunkNumber}-{LastChunkNumber} | NextId: {NextRecordId} | " +
               $"Flags: {(IsDirty ? "Dirty " : "")}{(IsFull ? "Full" : "")}".TrimEnd();
    }
}