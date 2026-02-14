using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace EvtxParserWasm;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
internal readonly struct RecordHeaderLayout
{
    public readonly uint Magic;
    public readonly uint Size;
    public readonly ulong EventRecordId;
    public readonly ulong WrittenTime;
}

public readonly record struct EvtxRecord(
    uint Size,
    ulong EventRecordId,
    ulong WrittenTime,
    int EventDataFileOffset,
    int EventDataLength,
    uint SizeCopy)
{
    /// <summary>
    /// Returns the event data as a span into the original file buffer.
    /// </summary>
    public ReadOnlySpan<byte> GetEventData(byte[] fileData) =>
        fileData.AsSpan(EventDataFileOffset, EventDataLength);

    /// <summary>
    /// Parses a record from a span into chunk data. Caller must verify record magic beforehand.
    /// Returns null if the record has an invalid size (corrupted/zero-data).
    /// </summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public static EvtxRecord? ParseEvtxRecord(ReadOnlySpan<byte> data, int fileOffset)
    {
        RecordHeaderLayout header = MemoryMarshal.Read<RecordHeaderLayout>(data);

        if (header.Size < 28 || header.Size > (uint)data.Length)
            return null;

        int eventDataLength = (int)(header.Size - 28);

        return new EvtxRecord(
            Size: header.Size,
            EventRecordId: header.EventRecordId,
            WrittenTime: header.WrittenTime,
            EventDataFileOffset: fileOffset + 24,
            EventDataLength: eventDataLength,
            SizeCopy: MemoryMarshal.Read<uint>(data[(int)(header.Size - 4)..])
        );
    }
}