namespace CrossPlatEvtxParser.BinXml;

/// <summary>
///     Intermediate representation nodes produced by the BinXml parser.
///     These are converted to XML or JSON during rendering.
/// </summary>
public abstract class BinXmlNode
{
    public BinXmlTokenType TokenType { get; init; }
}

public class BinXmlFragmentHeaderNode : BinXmlNode
{
    public byte MajorVersion { get; init; }
    public byte MinorVersion { get; init; }
    public byte Flags { get; init; }
}

public class BinXmlElementNode : BinXmlNode
{
    public string Name { get; set; } = string.Empty;
    public bool HasAttributes { get; init; }
    public List<BinXmlAttributeNode> Attributes { get; set; } = new();
    public List<BinXmlNode> Children { get; set; } = new();
}

public class BinXmlAttributeNode : BinXmlNode
{
    public string Name { get; set; } = string.Empty;
    public BinXmlNode? Value { get; set; }
}

public class BinXmlValueNode : BinXmlNode
{
    public BinXmlValueType ValueType { get; init; }
    public object? Data { get; init; }

    public string AsString()
    {
        return Data switch
        {
            null => string.Empty,
            string s => s,
            byte[] b => Convert.ToHexString(b),
            DateTime dt => dt.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ"),
            Guid g => $"{{{g}}}",
            bool val => val ? "true" : "false",
            _ => Data.ToString() ?? string.Empty
        };
    }
}

public class BinXmlSubstitutionNode : BinXmlNode
{
    public ushort SubstitutionId { get; init; }
    public BinXmlValueType ValueType { get; init; }
    public bool IsOptional { get; init; }
}

public class BinXmlTemplateInstanceNode : BinXmlNode
{
    public Guid TemplateGuid { get; init; }
    public uint TemplateId { get; init; }
    public BinXmlElementNode? TemplateElement { get; set; }
    public List<BinXmlValueNode> SubstitutionValues { get; set; } = new();
}

public class BinXmlEntityRefNode : BinXmlNode
{
    public string Name { get; set; } = string.Empty;
}

public class BinXmlCDataNode : BinXmlNode
{
    public string Text { get; set; } = string.Empty;
}

public class BinXmlCharRefNode : BinXmlNode
{
    public ushort CharValue { get; init; }
}

public class BinXmlProcessingInstructionNode : BinXmlNode
{
    public string Target { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}