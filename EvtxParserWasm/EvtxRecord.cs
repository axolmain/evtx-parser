using System.Buffers.Binary;

namespace EvtxParserWasm;

public record EvtxRecord(uint Size, ulong EventRecordId, ulong WrittenTime, byte[] EventData, uint SizeCopy)
{
    public static EvtxRecord ParseEvtxRecord(byte[] data) => ParseBytes(data);

    private static EvtxRecord ParseBytes(ReadOnlySpan<byte> data)
    {
        if (!data[..4].SequenceEqual("\x2a\x2a\x00\x00"u8))
            throw new InvalidDataException("Invalid Record signature");

        uint size = BinaryPrimitives.ReadUInt32LittleEndian(data[4..]);
        return new EvtxRecord(
            Size: size,
            EventRecordId: BinaryPrimitives.ReadUInt64LittleEndian(data[8..]),
            WrittenTime: BinaryPrimitives.ReadUInt64LittleEndian(data[16..]),
            EventData: data[24..(int)(size - 4)].ToArray(), // everything between the fixed header and trailing SizeCopy
            SizeCopy: BinaryPrimitives.ReadUInt32LittleEndian(data[(int)(size - 4)..])
        );
    }
}