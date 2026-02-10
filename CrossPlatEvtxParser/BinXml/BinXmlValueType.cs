namespace CrossPlatEvtxParser.BinXml;

/// <summary>
///     Value types used in Binary XML substitutions and value tokens.
///     Array variants have bit 7 set (0x80).
/// </summary>
public enum BinXmlValueType : byte
{
    Null = 0x00,
    String = 0x01, // UTF-16LE
    AnsiString = 0x02, // ANSI/codepage
    Int8 = 0x03,
    UInt8 = 0x04,
    Int16 = 0x05,
    UInt16 = 0x06,
    Int32 = 0x07,
    UInt32 = 0x08,
    Int64 = 0x09,
    UInt64 = 0x0A,
    Real32 = 0x0B,
    Real64 = 0x0C,
    Bool = 0x0D,
    Binary = 0x0E,
    Guid = 0x0F,
    SizeT = 0x10,
    FileTime = 0x11,
    SystemTime = 0x12,
    Sid = 0x13,
    HexInt32 = 0x14,
    HexInt64 = 0x15,

    // Special types
    EvtHandle = 0x20,
    BinXml = 0x21,
    EvtXml = 0x23,

    // Array flag (OR with base type)
    ArrayFlag = 0x80,

    // Commonly used array variants
    StringArray = 0x81,
    AnsiStringArray = 0x82,
    Int8Array = 0x83,
    UInt8Array = 0x84,
    Int16Array = 0x85,
    UInt16Array = 0x86,
    Int32Array = 0x87,
    UInt32Array = 0x88,
    Int64Array = 0x89,
    UInt64Array = 0x8A,
    Real32Array = 0x8B,
    Real64Array = 0x8C,
    BoolArray = 0x8D,
    GuidArray = 0x8F,
    FileTimeArray = 0x91,
    SystemTimeArray = 0x92,
    SidArray = 0x93,
    HexInt32Array = 0x94,
    HexInt64Array = 0x95
}

public static class BinXmlValueTypeExtensions
{
    public static bool IsArray(this BinXmlValueType vt)
    {
        return ((byte)vt & 0x80) != 0;
    }

    public static BinXmlValueType BaseType(this BinXmlValueType vt)
    {
        return (BinXmlValueType)((byte)vt & 0x7F);
    }

    /// <summary>Get the fixed size for a scalar value type, or -1 if variable.</summary>
    public static int GetFixedSize(this BinXmlValueType vt)
    {
        return vt.BaseType() switch
        {
            BinXmlValueType.Null => 0,
            BinXmlValueType.Int8 => 1,
            BinXmlValueType.UInt8 => 1,
            BinXmlValueType.Int16 => 2,
            BinXmlValueType.UInt16 => 2,
            BinXmlValueType.Int32 => 4,
            BinXmlValueType.UInt32 => 4,
            BinXmlValueType.Int64 => 8,
            BinXmlValueType.UInt64 => 8,
            BinXmlValueType.Real32 => 4,
            BinXmlValueType.Real64 => 8,
            BinXmlValueType.Bool => 4,
            BinXmlValueType.Guid => 16,
            BinXmlValueType.FileTime => 8,
            BinXmlValueType.SystemTime => 16,
            BinXmlValueType.HexInt32 => 4,
            BinXmlValueType.HexInt64 => 8,
            _ => -1 // Variable size
        };
    }
}