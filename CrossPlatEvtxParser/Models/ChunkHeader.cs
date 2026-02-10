namespace CrossPlatEvtxParser.Models;

/// <summary>
///     Represents a 65536-byte chunk with a 512-byte header.
///     Signature: "ElfChnk\0" (8 bytes)
/// </summary>
public class EvtxChunkHeader
{
    public const int ChunkSize = 65536;
    public const int HeaderSize = 512;
    public const int HeaderDataSize = 128;
    public const int CommonStringTableOffset = 128;
    public const int CommonStringTableCount = 64;
    public const int TemplatePtrTableOffset = 384;
    public const int TemplatePtrTableCount = 32;
    public static readonly byte[] ExpectedSignature = "ElfChnk\0"u8.ToArray();

    /// <summary>Offset 0, 8 bytes: "ElfChnk\0"</summary>
    public byte[] Signature { get; set; } = new byte[8];

    /// <summary>Offset 8, 8 bytes</summary>
    public ulong FirstEventRecordNumber { get; set; }

    /// <summary>Offset 16, 8 bytes</summary>
    public ulong LastEventRecordNumber { get; set; }

    /// <summary>Offset 24, 8 bytes</summary>
    public ulong FirstEventRecordId { get; set; }

    /// <summary>Offset 32, 8 bytes</summary>
    public ulong LastEventRecordId { get; set; }

    /// <summary>Offset 40, 4 bytes: always 128</summary>
    public uint HeaderSizeField { get; set; }

    /// <summary>Offset 44, 4 bytes: relative to chunk start</summary>
    public uint LastEventRecordDataOffset { get; set; }

    /// <summary>Offset 48, 4 bytes: relative to chunk start</summary>
    public uint FreeSpaceOffset { get; set; }

    /// <summary>Offset 52, 4 bytes: CRC32 of event record data</summary>
    public uint EventRecordsChecksum { get; set; }

    // Offset 56: 64 bytes unknown/empty
    // Offset 120: 4 bytes unknown flags

    /// <summary>Offset 124, 4 bytes: CRC32 of bytes 0-119 and 128-511</summary>
    public uint HeaderChecksum { get; set; }

    /// <summary>Offset 128, 256 bytes: 64 x 4-byte common string offsets</summary>
    public uint[] CommonStringOffsets { get; set; } = new uint[CommonStringTableCount];

    /// <summary>Offset 384, 128 bytes: 32 x 4-byte template pointers</summary>
    public uint[] TemplatePointers { get; set; } = new uint[TemplatePtrTableCount];

    public bool HasValidSignature()
    {
        return Signature.AsSpan().SequenceEqual(ExpectedSignature);
    }

    public override string ToString()
    {
        return $"Chunk | Records #{FirstEventRecordNumber}-{LastEventRecordNumber} | " +
               $"IDs {FirstEventRecordId}-{LastEventRecordId} | " +
               $"FreeSpace @ 0x{FreeSpaceOffset:X}";
    }
}