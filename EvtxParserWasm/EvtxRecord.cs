using System.Buffers.Binary;

namespace EvtxParserWasm;

public record EvtxRecord(uint Size, ulong EventRecordId, ulong WrittenTime, byte[] EventData, uint SizeCopy)
{
    /// <summary>
    /// Parses a record from a span into chunk data. Caller must verify record magic beforehand.
    /// Returns null if the record has an invalid size (corrupted/zero-data).
    /// </summary>
    public static EvtxRecord? ParseEvtxRecord(ReadOnlySpan<byte> data)
    {
        uint size = BinaryPrimitives.ReadUInt32LittleEndian(data[4..]);

        if (size < 28 || size > (uint)data.Length)
            return null;

        return new EvtxRecord(
            Size: size,
            EventRecordId: BinaryPrimitives.ReadUInt64LittleEndian(data[8..]),
            WrittenTime: BinaryPrimitives.ReadUInt64LittleEndian(data[16..]),
            EventData: data[24..(int)(size - 4)].ToArray(),
            SizeCopy: BinaryPrimitives.ReadUInt32LittleEndian(data[(int)(size - 4)..])
        );
    }
}