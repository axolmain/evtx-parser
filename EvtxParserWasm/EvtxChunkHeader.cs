using System.Buffers.Binary;

namespace EvtxParserWasm;

/// <summary>
/// The chunk header tracks which event records are contained within, provides fast-lookup caches for common strings
/// and templates, and stores CRC32 checksums. The header checksum covers bytes 0x00–0x77 (first 120 bytes). The event
/// records checksum covers all event record data in the chunk. The common string offset table allows the Binary XML
/// parser to resolve frequently-used element/attribute names without re-reading each record.
/// </summary>
public readonly record struct EvtxChunkHeader(
    ulong FirstEventRecordNumber,
    ulong LastEventRecordNumber,
    ulong FirstEventRecordId,
    ulong LastEventRecordId,
    uint HeaderSize,
    uint LastEventRecordDataOffset,
    uint FreeSpaceOffset,
    uint EventRecordsChecksum,
    ChunkFlags Flags,
    uint Checksum)
{
    public static EvtxChunkHeader ParseEvtxChunkHeader(ReadOnlySpan<byte> data)
    {
        if (data.Length < 512)
            throw new InvalidDataException("Chunk header too short");

        if (!data[..8].SequenceEqual("ElfChnk\0"u8))
            throw new InvalidDataException("Invalid Chunk signature");

        return new EvtxChunkHeader(
            FirstEventRecordNumber: BinaryPrimitives.ReadUInt64LittleEndian(data[8..]),
            LastEventRecordNumber: BinaryPrimitives.ReadUInt64LittleEndian(data[16..]),
            FirstEventRecordId: BinaryPrimitives.ReadUInt64LittleEndian(data[24..]),
            LastEventRecordId: BinaryPrimitives.ReadUInt64LittleEndian(data[32..]),
            HeaderSize: BinaryPrimitives.ReadUInt32LittleEndian(data[40..]),
            LastEventRecordDataOffset: BinaryPrimitives.ReadUInt32LittleEndian(data[44..]),
            FreeSpaceOffset: BinaryPrimitives.ReadUInt32LittleEndian(data[48..]),
            EventRecordsChecksum: BinaryPrimitives.ReadUInt32LittleEndian(data[52..]),
            Flags: (ChunkFlags)BinaryPrimitives.ReadUInt32LittleEndian(data[120..]),
            Checksum: BinaryPrimitives.ReadUInt32LittleEndian(data[124..])
        );
    }
}