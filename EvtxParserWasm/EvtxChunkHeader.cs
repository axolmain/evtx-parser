using System.Buffers.Binary;
using System.Runtime.InteropServices;

namespace EvtxParserWasm;

/// <summary>
/// The chunk header tracks which event records are contained within, provides fast-lookup caches for common strings
/// and templates, and stores CRC32 checksums. The header checksum covers bytes 0x00–0x77 (first 120 bytes). The event
/// records checksum covers all event record data in the chunk. The common string offset table allows the Binary XML
/// parser to resolve frequently-used element/attribute names without re-reading each record.
/// </summary>
/// <param name="FirstEventRecordNumber">Offset 8, 8 bytes — Log record number of first event in this chunk.</param>
/// <param name="LastEventRecordNumber">Offset 16, 8 bytes — Log record number of last event in this chunk.</param>
/// <param name="FirstEventRecordId">Offset 24, 8 bytes — Record identifier of first event.</param>
/// <param name="LastEventRecordId">Offset 32, 8 bytes — Record identifier of last event.</param>
/// <param name="HeaderSize">Offset 40, 4 bytes — Size of the header data, always 128.</param>
/// <param name="LastEventRecordDataOffset">Offset 44, 4 bytes — Offset relative to chunk start of last event record.</param>
/// <param name="FreeSpaceOffset">Offset 48, 4 bytes — Offset relative to chunk start where free space begins.</param>
/// <param name="EventRecordsChecksum">Offset 52, 4 bytes — CRC32 of all event record data in this chunk.</param>
/// <param name="Flags">Offset 120, 4 bytes — Unknown, possibly flags.</param>
/// <param name="Checksum">Offset 124, 4 bytes — CRC32 of first 120 bytes and bytes 128–512 of the chunk.</param>
/// <param name="CommonStringOffsets">Offset 128, 256 bytes — Offset table for 64 cached string names within this chunk.</param>
/// <param name="TemplatePtrs">Offset 384, 128 bytes — Offset table for 32 cached template definitions within this chunk.</param>
public record EvtxChunkHeader(
    ulong FirstEventRecordNumber,
    ulong LastEventRecordNumber,
    ulong FirstEventRecordId,
    ulong LastEventRecordId,
    uint HeaderSize,
    uint LastEventRecordDataOffset,
    uint FreeSpaceOffset,
    uint EventRecordsChecksum,
    ChunkFlags Flags,
    uint Checksum,
    uint[] CommonStringOffsets,
    uint[] TemplatePtrs)
{
    public static EvtxChunkHeader ParseEvtxChunkHeader(ReadOnlySpan<byte> data)
    {
        if (data.Length < 512)
            throw new InvalidDataException("Chunk header too short");

        if (!data[..8].SequenceEqual("ElfChnk\0"u8))
            throw new InvalidDataException("Invalid Chunk signature");

        uint[] commonStringOffsets = MemoryMarshal.Cast<byte, uint>(data.Slice(128, 256)).ToArray();
        uint[] templatePtrs = MemoryMarshal.Cast<byte, uint>(data.Slice(384, 128)).ToArray();

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
            Checksum: BinaryPrimitives.ReadUInt32LittleEndian(data[124..]),
            CommonStringOffsets: commonStringOffsets,
            TemplatePtrs: templatePtrs
        );
    }
};