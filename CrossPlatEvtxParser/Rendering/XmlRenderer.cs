using System.Text;
using System.Xml;
using CrossPlatEvtxParser.BinXml;

namespace CrossPlatEvtxParser.Rendering;

/// <summary>
///     Renders BinXml node trees into formatted XML strings.
/// </summary>
public class XmlRenderer
{
    private readonly bool _indent;

    public XmlRenderer(bool indent = true)
    {
        _indent = indent;
    }

    public string Render(List<BinXmlNode> nodes)
    {
        StringBuilder sb = new();
        XmlWriterSettings settings = new()
        {
            Indent = _indent,
            OmitXmlDeclaration = true,
            ConformanceLevel = ConformanceLevel.Fragment
        };

        using XmlWriter writer = XmlWriter.Create(sb, settings);
        foreach (BinXmlNode node in nodes) RenderNode(writer, node);
        writer.Flush();
        return sb.ToString();
    }

    private void RenderNode(XmlWriter writer, BinXmlNode node)
    {
        switch (node)
        {
            case BinXmlFragmentHeaderNode:
                // Fragment headers don't produce XML output
                break;

            case BinXmlTemplateInstanceNode template:
                RenderTemplateInstance(writer, template);
                break;

            case BinXmlElementNode element:
                RenderElement(writer, element);
                break;

            case BinXmlValueNode value:
                writer.WriteString(value.AsString());
                break;

            case BinXmlCDataNode cdata:
                writer.WriteCData(cdata.Text);
                break;

            case BinXmlCharRefNode charRef:
                writer.WriteCharEntity((char)charRef.CharValue);
                break;

            case BinXmlEntityRefNode entityRef:
                writer.WriteEntityRef(entityRef.Name);
                break;

            case BinXmlProcessingInstructionNode pi:
                writer.WriteProcessingInstruction(pi.Target, pi.Data);
                break;

            case BinXmlSubstitutionNode sub:
                // Substitutions that weren't resolved - write placeholder
                writer.WriteString($"[Sub:{sub.SubstitutionId}]");
                break;
        }
    }

    private void RenderElement(XmlWriter writer, BinXmlElementNode element)
    {
        writer.WriteStartElement(element.Name);

        foreach (BinXmlAttributeNode attr in element.Attributes)
        {
            string attrValue = attr.Value switch
            {
                BinXmlValueNode v => v.AsString(),
                BinXmlSubstitutionNode _ => string.Empty,
                _ => string.Empty
            };
            writer.WriteAttributeString(attr.Name, attrValue);
        }

        foreach (BinXmlNode child in element.Children) RenderNode(writer, child);

        writer.WriteEndElement();
    }

    private void RenderTemplateInstance(XmlWriter writer, BinXmlTemplateInstanceNode template)
    {
        if (template.TemplateElement != null)
            // Render the template element with substitutions resolved
            RenderElementWithSubstitutions(writer, template.TemplateElement, template.SubstitutionValues);
    }

    private void RenderElementWithSubstitutions(XmlWriter writer, BinXmlElementNode element,
        List<BinXmlValueNode> substitutions)
    {
        writer.WriteStartElement(element.Name);

        foreach (BinXmlAttributeNode attr in element.Attributes)
        {
            string attrValue = ResolveValue(attr.Value, substitutions);
            writer.WriteAttributeString(attr.Name, attrValue);
        }

        foreach (BinXmlNode child in element.Children) RenderNodeWithSubstitutions(writer, child, substitutions);

        writer.WriteEndElement();
    }

    private void RenderNodeWithSubstitutions(XmlWriter writer, BinXmlNode node, List<BinXmlValueNode> substitutions)
    {
        switch (node)
        {
            case BinXmlElementNode element:
                RenderElementWithSubstitutions(writer, element, substitutions);
                break;

            case BinXmlSubstitutionNode sub:
                if (sub.SubstitutionId < substitutions.Count)
                {
                    BinXmlValueNode val = substitutions[sub.SubstitutionId];
                    if (val.Data != null)
                    {
                        // Special: if the substitution value is a nested BinXml node list, render those
                        if (val.Data is List<BinXmlNode> nestedNodes)
                            foreach (BinXmlNode n in nestedNodes)
                                RenderNode(writer, n);
                        else
                            writer.WriteString(val.AsString());
                    }
                    else if (!sub.IsOptional)
                    {
                        writer.WriteString(string.Empty);
                    }
                }

                break;

            case BinXmlValueNode value:
                writer.WriteString(value.AsString());
                break;

            case BinXmlCDataNode cdata:
                writer.WriteCData(cdata.Text);
                break;

            case BinXmlCharRefNode charRef:
                writer.WriteCharEntity((char)charRef.CharValue);
                break;

            case BinXmlEntityRefNode entityRef:
                writer.WriteEntityRef(entityRef.Name);
                break;

            case BinXmlProcessingInstructionNode pi:
                writer.WriteProcessingInstruction(pi.Target, pi.Data);
                break;

            case BinXmlFragmentHeaderNode:
                break;

            case BinXmlTemplateInstanceNode nested:
                RenderTemplateInstance(writer, nested);
                break;
        }
    }

    private string ResolveValue(BinXmlNode? node, List<BinXmlValueNode> substitutions)
    {
        return node switch
        {
            BinXmlValueNode v => v.AsString(),
            BinXmlSubstitutionNode sub when sub.SubstitutionId < substitutions.Count =>
                substitutions[sub.SubstitutionId].AsString(),
            _ => string.Empty
        };
    }
}