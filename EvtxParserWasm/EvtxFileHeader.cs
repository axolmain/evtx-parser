using System.Buffers.Binary;

namespace EvtxParserWasm;

[Flags]
public enum HeaderFlags : uint
{
    None    = 0x0,
    Dirty   = 0x1,
    Full    = 0x2,
    NoCrc32 = 0x4,
}

public record EvtxFileHeader(
    byte[] Signature,           // Offset 0, 8 bytes
    ulong FirstChunkNumber,     // Offset 8, 8 bytes
    ulong LastChunkNumber,      // Offset 16, 8 bytes
    ulong NextRecordIdentifier, // Offset 24, 8 bytes
    uint HeaderSize,            // Offset 32, 4 bytes, value: 128
    ushort MinorFormatVersion,  // Offset 36, 2 bytes
    ushort MajorFormatVersion,  // Offset 38, 2 bytes
    ushort HeaderBlockSize,     // Offset 40, 2 bytes, value: 4096
    ushort NumberOfChunks,      // Offset 42, 2 bytes
    HeaderFlags FileFlags,      // Offset 120, 4 bytes
    uint Checksum               // Offset 124, 4 bytes, CRC32 of first 120 bytes
)
{

    public static EvtxFileHeader ParseEvtxFileHeader(byte[] data)
    {
        return ParseBytes(data);
    }

    private static EvtxFileHeader ParseBytes(ReadOnlySpan<byte> data)
    {
        if (!data[..8].SequenceEqual("ElfFile\0"u8))
            throw new InvalidDataException("Invalid EVTX signature");

        return new EvtxFileHeader(
            Signature: data[..8].ToArray(),
            FirstChunkNumber: BinaryPrimitives.ReadUInt64LittleEndian(data[8..]),
            LastChunkNumber: BinaryPrimitives.ReadUInt64LittleEndian(data[16..]),
            NextRecordIdentifier: BinaryPrimitives.ReadUInt64LittleEndian(data[24..]),
            HeaderSize: BinaryPrimitives.ReadUInt32LittleEndian(data[32..]),
            MinorFormatVersion: BinaryPrimitives.ReadUInt16LittleEndian(data[36..]),
            MajorFormatVersion: BinaryPrimitives.ReadUInt16LittleEndian(data[38..]),
            HeaderBlockSize: BinaryPrimitives.ReadUInt16LittleEndian(data[40..]),
            NumberOfChunks: BinaryPrimitives.ReadUInt16LittleEndian(data[42..]),
            FileFlags: (HeaderFlags)BinaryPrimitives.ReadUInt32LittleEndian(data[120..]),
            Checksum: BinaryPrimitives.ReadUInt32LittleEndian(data[124..])
            );
    }
}