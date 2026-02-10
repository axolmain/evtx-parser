namespace CrossPlatEvtxParser.Models;

/// <summary>
///     Represents a variable-length event record within a chunk.
///     Signature: 0x00002A2A
/// </summary>
public class EvtxEventRecord
{
    public const uint ExpectedSignature = 0x00002A2A;

    /// <summary>Offset 0, 4 bytes: 0x2A 0x2A 0x00 0x00</summary>
    public uint Signature { get; set; }

    /// <summary>Offset 4, 4 bytes: total size including header</summary>
    public uint Size { get; set; }

    /// <summary>Offset 8, 8 bytes</summary>
    public ulong EventRecordId { get; set; }

    /// <summary>Offset 16, 8 bytes: Windows FILETIME (100ns intervals since 1601-01-01)</summary>
    public long Timestamp { get; set; }

    /// <summary>Offset 24, variable: the binary XML payload</summary>
    public byte[] BinaryXmlData { get; set; } = Array.Empty<byte>();

    /// <summary>Last 4 bytes: copy of Size for backward navigation</summary>
    public uint SizeCopy { get; set; }

    public bool IsValid => Signature == ExpectedSignature && Size == SizeCopy && Size > 0;

    public DateTime GetTimestampUtc()
    {
        try
        {
            return DateTime.FromFileTimeUtc(Timestamp);
        }
        catch
        {
            return DateTime.MinValue;
        }
    }

    public override string ToString()
    {
        return $"Record #{EventRecordId} | {GetTimestampUtc():yyyy-MM-dd HH:mm:ss.fff}Z | Size: {Size} bytes";
    }
}