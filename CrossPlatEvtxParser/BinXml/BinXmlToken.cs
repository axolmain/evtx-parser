namespace CrossPlatEvtxParser.BinXml;

/// <summary>
///     Binary XML token types as defined in MS-EVEN6.
///     Tokens with bit 6 set (0x40) indicate "has more data" or "has attributes" variants.
/// </summary>
public enum BinXmlTokenType : byte
{
    EOF = 0x00,
    OpenStartElement = 0x01, // No attributes
    CloseStartElement = 0x02,
    CloseEmptyElement = 0x03,
    EndElement = 0x04,
    Value = 0x05,
    Attribute = 0x06,
    CDataSection = 0x07,
    CharRef = 0x08,
    EntityRef = 0x09,
    PITarget = 0x0A,
    PIData = 0x0B,
    TemplateInstance = 0x0C,
    NormalSubstitution = 0x0D,
    OptionalSubstitution = 0x0E,
    FragmentHeader = 0x0F,

    // "More data" / "has attributes" variants (bit 6 set)
    OpenStartElementAttrs = 0x41, // Element with attributes
    ValueMore = 0x45, // More value data follows
    AttributeMore = 0x46, // More attribute data follows
    CDataSectionMore = 0x47,
    CharRefMore = 0x48,
    EntityRefMore = 0x49
}

public static class BinXmlTokenExtensions
{
    /// <summary>Get the base token type (strip the 0x40 "more" flag)</summary>
    public static BinXmlTokenType BaseType(this BinXmlTokenType token)
    {
        return (BinXmlTokenType)((byte)token & 0x3F);
    }

    /// <summary>Check if the "more data follows" flag is set</summary>
    public static bool HasMoreData(this BinXmlTokenType token)
    {
        return ((byte)token & 0x40) != 0;
    }

    /// <summary>Check if this token represents an element open with attributes</summary>
    public static bool IsOpenElementWithAttributes(this BinXmlTokenType token)
    {
        return token == BinXmlTokenType.OpenStartElementAttrs;
    }
}