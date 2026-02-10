using System.Text.Json;
using System.Text.Json.Serialization;
using CrossPlatEvtxParser.BinXml;

namespace CrossPlatEvtxParser.Rendering;

/// <summary>
///     Extracts structured event metadata from BinXml nodes.
///     Windows Event Log XML structure:
///     <Event xmlns="...">
///         <System>
///             <Provider Name="..." Guid="..." />
///             <EventID>...</EventID>
///             <Level>...</Level>
///             <Task>...</Task>
///             <Keywords>...</Keywords>
///             <TimeCreated SystemTime="..." />
///             <EventRecordID>...</EventRecordID>
///             <Channel>...</Channel>
///             <Computer>...</Computer>
///             <Security UserID="..." />
///         </System>
///         <EventData>
///             <Data Name="...">...</Data>
///         </EventData>
///     </Event>
/// </summary>
public class EventDataExtractor
{
    /// <summary>
    ///     Extract key/value event data from BinXml nodes.
    /// </summary>
    public EventInfo Extract(List<BinXmlNode> nodes, List<BinXmlValueNode>? substitutions = null)
    {
        EventInfo info = new();

        // Find the root Event element (may be wrapped in template or fragment)
        BinXmlElementNode? eventElement = FindElement(nodes, "Event") ?? FindFirstElement(nodes);
        if (eventElement == null)
            return info;

        BinXmlElementNode? resolvedElement = eventElement;

        // Check all top-level nodes - might be a template instance
        foreach (BinXmlNode node in nodes)
            if (node is BinXmlTemplateInstanceNode template && template.TemplateElement != null)
            {
                resolvedElement = template.TemplateElement;
                substitutions = template.SubstitutionValues;
                break;
            }

        // Extract System data
        BinXmlElementNode? systemElement = FindChildElement(resolvedElement, "System");
        if (systemElement != null) ExtractSystemData(systemElement, info, substitutions);

        // Extract EventData or UserData
        BinXmlElementNode? eventDataElement = FindChildElement(resolvedElement, "EventData")
                                              ?? FindChildElement(resolvedElement, "UserData");
        if (eventDataElement != null) ExtractEventData(eventDataElement, info, substitutions);

        return info;
    }

    private void ExtractSystemData(BinXmlElementNode system, EventInfo info, List<BinXmlValueNode>? subs)
    {
        foreach (BinXmlNode child in system.Children)
        {
            if (child is not BinXmlElementNode el) continue;

            switch (el.Name)
            {
                case "Provider":
                    info.ProviderName = GetAttributeValue(el, "Name", subs);
                    info.ProviderGuid = GetAttributeValue(el, "Guid", subs);
                    break;
                case "EventID":
                    info.EventId = GetTextContent(el, subs);
                    break;
                case "Version":
                    info.Version = GetTextContent(el, subs);
                    break;
                case "Level":
                    info.Level = GetTextContent(el, subs);
                    break;
                case "Task":
                    info.Task = GetTextContent(el, subs);
                    break;
                case "Opcode":
                    info.Opcode = GetTextContent(el, subs);
                    break;
                case "Keywords":
                    info.Keywords = GetTextContent(el, subs);
                    break;
                case "TimeCreated":
                    info.TimeCreated = GetAttributeValue(el, "SystemTime", subs);
                    break;
                case "EventRecordID":
                    info.EventRecordId = GetTextContent(el, subs);
                    break;
                case "Correlation":
                    info.ActivityId = GetAttributeValue(el, "ActivityID", subs);
                    break;
                case "Execution":
                    info.ProcessId = GetAttributeValue(el, "ProcessID", subs);
                    info.ThreadId = GetAttributeValue(el, "ThreadID", subs);
                    break;
                case "Channel":
                    info.Channel = GetTextContent(el, subs);
                    break;
                case "Computer":
                    info.Computer = GetTextContent(el, subs);
                    break;
                case "Security":
                    info.UserId = GetAttributeValue(el, "UserID", subs);
                    break;
            }
        }
    }

    private void ExtractEventData(BinXmlElementNode eventData, EventInfo info, List<BinXmlValueNode>? subs)
    {
        foreach (BinXmlNode child in eventData.Children)
        {
            if (child is not BinXmlElementNode el) continue;

            if (el.Name == "Data")
            {
                string? name = GetAttributeValue(el, "Name", subs);
                string value = GetTextContent(el, subs);
                if (name != null)
                    info.Data[name] = value;
                else
                    info.Data[$"Data{info.Data.Count}"] = value;
            }
            else
            {
                // UserData can have arbitrary child elements
                string value = GetTextContent(el, subs);
                info.Data[el.Name] = value;
            }
        }
    }

    private string? GetAttributeValue(BinXmlElementNode el, string attrName, List<BinXmlValueNode>? subs)
    {
        foreach (BinXmlAttributeNode attr in el.Attributes)
            if (attr.Name == attrName)
                return attr.Value switch
                {
                    BinXmlValueNode v => v.AsString(),
                    BinXmlSubstitutionNode sub when subs != null && sub.SubstitutionId < subs.Count =>
                        subs[sub.SubstitutionId].AsString(),
                    _ => null
                };

        return null;
    }

    private string GetTextContent(BinXmlElementNode el, List<BinXmlValueNode>? subs)
    {
        foreach (BinXmlNode child in el.Children)
            switch (child)
            {
                case BinXmlValueNode v:
                    return v.AsString();
                case BinXmlSubstitutionNode sub when subs != null && sub.SubstitutionId < subs.Count:
                    return subs[sub.SubstitutionId].AsString();
            }

        return string.Empty;
    }

    private BinXmlElementNode? FindElement(List<BinXmlNode> nodes, string name)
    {
        foreach (BinXmlNode node in nodes)
        {
            if (node is BinXmlElementNode el && el.Name == name)
                return el;
            if (node is BinXmlTemplateInstanceNode tmpl && tmpl.TemplateElement?.Name == name)
                return tmpl.TemplateElement;
        }

        return null;
    }

    private BinXmlElementNode? FindFirstElement(List<BinXmlNode> nodes)
    {
        foreach (BinXmlNode node in nodes)
        {
            if (node is BinXmlElementNode el)
                return el;
            if (node is BinXmlTemplateInstanceNode tmpl && tmpl.TemplateElement != null)
                return tmpl.TemplateElement;
        }

        return null;
    }

    private BinXmlElementNode? FindChildElement(BinXmlElementNode parent, string name)
    {
        foreach (BinXmlNode child in parent.Children)
            if (child is BinXmlElementNode el && el.Name == name)
                return el;
        return null;
    }
}

/// <summary>
///     Structured event information extracted from a Windows Event Log record.
/// </summary>
public class EventInfo
{
    // System fields
    public string? ProviderName { get; set; }
    public string? ProviderGuid { get; set; }
    public string? EventId { get; set; }
    public string? Version { get; set; }
    public string? Level { get; set; }
    public string? Task { get; set; }
    public string? Opcode { get; set; }
    public string? Keywords { get; set; }
    public string? TimeCreated { get; set; }
    public string? EventRecordId { get; set; }
    public string? ActivityId { get; set; }
    public string? ProcessId { get; set; }
    public string? ThreadId { get; set; }
    public string? Channel { get; set; }
    public string? Computer { get; set; }
    public string? UserId { get; set; }

    // EventData / UserData
    public Dictionary<string, string> Data { get; set; } = new();

    public string ToJsonString()
    {
        return JsonSerializer.Serialize(this, new JsonSerializerOptions
        {
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
    }
}