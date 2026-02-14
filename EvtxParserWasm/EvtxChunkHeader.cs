namespace EvtxParserWasm;

/// <summary>
/// The chunk header tracks which event records are contained within, provides fast-lookup caches for common strings
/// and templates, and stores CRC32 checksums. The header checksum covers bytes 0x00–0x77 (first 120 bytes). The event
/// records checksum covers all event record data in the chunk. The common string offset table allows the Binary XML
/// parser to resolve frequently-used element/attribute names without re-reading each record.
/// </summary>
/// <param name="Signature">8 bytes — Magic bytes identifying a valid chunk ("ElfChnk\0").</param>
/// <param name="FirstEventRecordNumber">8 bytes — Log record number of first event in this chunk.</param>
/// <param name="LastEventRecordNumber">8 bytes — Log record number of last event in this chunk.</param>
/// <param name="FirstEventRecordId">8 bytes — Record identifier of first event.</param>
/// <param name="LastEventRecordId">8 bytes — Record identifier of last event.</param>
/// <param name="HeaderSize">4 bytes — Size of the header data, always 128.</param>
/// <param name="LastEventRecordDataOffset">4 bytes — Offset relative to chunk start of last event record.</param>
/// <param name="FreeSpaceOffset">4 bytes — Offset relative to chunk start where free space begins.</param>
/// <param name="EventRecordsChecksum">4 bytes — CRC32 of all event record data in this chunk.</param>
/// <param name="Checksum">4 bytes — CRC32 of chunk header bytes 0x00–0x77.</param>
/// <param name="CommonStringOffsets">256 bytes — Offset table for 64 cached string names within this chunk.</param>
/// <param name="TemplatePtrs">128 bytes — Offset table for 32 cached template definitions within this chunk.</param>
public record EvtxChunkHeader(byte[] Signature, ulong FirstEventRecordNumber, ulong LastEventRecordNumber,
    ulong FirstEventRecordId, ulong LastEventRecordId, uint HeaderSize, uint LastEventRecordDataOffset,
    uint FreeSpaceOffset, uint EventRecordsChecksum, uint Checksum, uint[] CommonStringOffsets, uint[] TemplatePtrs)
{
    
};