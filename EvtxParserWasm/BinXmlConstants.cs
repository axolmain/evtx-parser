using System.Runtime.InteropServices;

namespace EvtxParserWasm;

/// <summary>
/// BinXml token types. Const bytes instead of enums to avoid cast overhead.
/// </summary>
internal static class BinXmlToken
{
    public const byte Eof = 0x00;
    public const byte OpenStartElement = 0x01;
    public const byte CloseStartElement = 0x02;
    public const byte CloseEmptyElement = 0x03;
    public const byte EndElement = 0x04;
    public const byte Value = 0x05;
    public const byte Attribute = 0x06;
    public const byte CDataSection = 0x07;
    public const byte CharRef = 0x08;
    public const byte EntityRef = 0x09;
    public const byte PITarget = 0x0A;
    public const byte PIData = 0x0B;
    public const byte TemplateInstance = 0x0C;
    public const byte NormalSubstitution = 0x0D;
    public const byte OptionalSubstitution = 0x0E;
    public const byte FragmentHeader = 0x0F;
    public const byte HasMoreDataFlag = 0x40;
}

/// <summary>
/// BinXml value types for substitution values.
/// </summary>
internal static class BinXmlValueType
{
    public const byte Null = 0x00;
    public const byte String = 0x01;
    public const byte AnsiString = 0x02;
    public const byte Int8 = 0x03;
    public const byte UInt8 = 0x04;
    public const byte Int16 = 0x05;
    public const byte UInt16 = 0x06;
    public const byte Int32 = 0x07;
    public const byte UInt32 = 0x08;
    public const byte Int64 = 0x09;
    public const byte UInt64 = 0x0A;
    public const byte Float = 0x0B;
    public const byte Double = 0x0C;
    public const byte Bool = 0x0D;
    public const byte Binary = 0x0E;
    public const byte Guid = 0x0F;
    public const byte SizeT = 0x10;
    public const byte FileTime = 0x11;
    public const byte SystemTime = 0x12;
    public const byte Sid = 0x13;
    public const byte HexInt32 = 0x14;
    public const byte HexInt64 = 0x15;
    public const byte BinXml = 0x21;
    public const byte ArrayFlag = 0x80;
}

/// <summary>
/// On-disk substitution descriptor layout: 2-byte size, 1-byte type, 1-byte padding.
/// Zero-copy readable via MemoryMarshal.Cast.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
internal readonly struct SubstitutionDescriptor
{
    public readonly ushort Size;
    public readonly byte Type;
    public readonly byte Padding;
}