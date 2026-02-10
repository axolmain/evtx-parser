using System.Text.Json;
using CrossPlatEvtxParser.BinXml;
using CrossPlatEvtxParser.Models;
using CrossPlatEvtxParser.Parsing;
using CrossPlatEvtxParser.Rendering;

namespace CrossPlatEvtxParser;

file class Program
{
    private static int Main(string[] args)
    {
        try
        {
            CliOptions options = ParseArguments(args);

            if (options.ShowHelp || string.IsNullOrEmpty(options.FilePath))
            {
                PrintHelp();
                return options.ShowHelp ? 0 : 1;
            }

            if (!File.Exists(options.FilePath))
            {
                Console.Error.WriteLine($"Error: File not found: {options.FilePath}");
                return 1;
            }

            // Process the EVTX file
            return ProcessEvtxFile(options.FilePath, options);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Fatal error: {ex.Message}");
            if (!string.IsNullOrEmpty(ex.StackTrace)) Console.Error.WriteLine($"Stack trace: {ex.StackTrace}");
            return 1;
        }
    }

    private static int ProcessEvtxFile(string filePath, CliOptions options)
    {
        using EvtxReader reader = new(filePath);
        EvtxFile file = reader.ReadFile(filePath);

        if (!file.IsValid)
        {
            Console.Error.WriteLine("Error: Invalid EVTX file signature");
            return 1;
        }

        // Display file summary
        Console.Error.WriteLine($"File: {Path.GetFileName(filePath)}");
        Console.Error.WriteLine($"Size: {file.FileSize:N0} bytes");
        Console.Error.WriteLine($"Header: {file.Header}");
        Console.Error.WriteLine($"Chunks: {file.Chunks.Count}");
        Console.Error.WriteLine($"Total Records: {file.TotalRecordCount}");
        Console.Error.WriteLine();

        return ProcessFormat(file, options);
    }

    private static int ProcessFormat(EvtxFile file, CliOptions options)
    {
        return options.Format switch
        {
            OutputFormat.Summary => ProcessSummaryFormat(file, options),
            OutputFormat.Json => ProcessJsonFormat(file, options),
            OutputFormat.Xml => ProcessXmlFormat(file, options),
            OutputFormat.Table => ProcessTableFormat(file, options),
            _ => 1
        };
    }

    private static int ProcessSummaryFormat(EvtxFile file, CliOptions options)
    {
        // Group records by provider & event ID
        Dictionary<string, Dictionary<string, int>> providerStats = new();
        int displayedCount = 0;

        foreach (EvtxChunk chunk in file.Chunks)
        foreach (EvtxEventRecord record in chunk.EventRecords)
        {
            if (!record.IsValid) continue;

            EventInfo parsedInfo = ExtractEventInfo(record, chunk);

            if (!MatchesFilters(parsedInfo, options)) continue;

            string provider = parsedInfo.ProviderName ?? "Unknown";
            string eventId = parsedInfo.EventId ?? "?";

            if (!providerStats.ContainsKey(provider))
                providerStats[provider] = new Dictionary<string, int>();

            if (!providerStats[provider].ContainsKey(eventId))
                providerStats[provider][eventId] = 0;

            providerStats[provider][eventId]++;
            displayedCount++;
        }

        Console.Out.WriteLine("Provider Summary:");
        foreach (string provider in providerStats.Keys.OrderBy(k => k))
        {
            Console.Out.WriteLine($"  {provider}:");
            foreach (string eventId in providerStats[provider].Keys.OrderBy(k => k))
            {
                int count = providerStats[provider][eventId];
                Console.Out.WriteLine($"    Event {eventId}: {count} records");
            }
        }

        Console.Error.WriteLine();
        Console.Error.WriteLine($"Displayed {displayedCount} records (out of {file.TotalRecordCount} total)");
        return 0;
    }

    private static int ProcessJsonFormat(EvtxFile file, CliOptions options)
    {
        List<object> records = new();
        int count = 0;

        foreach (EvtxChunk chunk in file.Chunks)
        {
            foreach (EvtxEventRecord record in chunk.EventRecords)
            {
                if (!record.IsValid) continue;

                EventInfo parsedInfo = ExtractEventInfo(record, chunk);

                if (!MatchesFilters(parsedInfo, options)) continue;
                if (options.RecordId > 0 && record.EventRecordId != options.RecordId) continue;

                records.Add(new
                {
                    RecordId = record.EventRecordId,
                    Timestamp = record.GetTimestampUtc().ToString("O"),
                    Provider = parsedInfo.ProviderName,
                    parsedInfo.EventId,
                    parsedInfo.Level,
                    parsedInfo.Channel,
                    parsedInfo.Computer,
                    parsedInfo.ProcessId,
                    parsedInfo.ThreadId,
                    parsedInfo.Data
                });

                count++;

                if (options.First > 0 && count >= options.First)
                    break;
            }

            if (options.First > 0 && count >= options.First)
                break;
        }

        // Handle --last by taking only the tail
        if (options.Last > 0 && records.Count > options.Last)
            records = records.TakeLast(options.Last).ToList();

        string json = JsonSerializer.Serialize(records, new JsonSerializerOptions { WriteIndented = true });
        Console.Out.WriteLine(json);
        return 0;
    }

    private static int ProcessXmlFormat(EvtxFile file, CliOptions options)
    {
        XmlRenderer renderer = new();
        int count = 0;

        foreach (EvtxChunk chunk in file.Chunks)
        {
            foreach (EvtxEventRecord record in chunk.EventRecords)
            {
                if (!record.IsValid) continue;
                if (options.RecordId > 0 && record.EventRecordId != options.RecordId) continue;

                // For XML, we must check filters by parsing first
                EventInfo parsedInfo = ExtractEventInfo(record, chunk);
                if (!MatchesFilters(parsedInfo, options)) continue;

                try
                {
                    // Parse BinXml: find the record offset within the chunk
                    int recordOffset = FindRecordOffsetInChunk(chunk, record.EventRecordId);
                    if (recordOffset < 0)
                    {
                        Console.Error.WriteLine($"Warning: Could not find offset for record {record.EventRecordId}");
                        continue;
                    }

                    // BinXml data starts at offset 24 within the record
                    int binXmlOffset = recordOffset + 24;
                    BinXmlParser parser = new(chunk.RawData);
                    List<BinXmlNode> nodes = parser.Parse(binXmlOffset);

                    string xml = renderer.Render(nodes);
                    Console.Out.WriteLine(
                        $"<!-- Record ID: {record.EventRecordId} at {record.GetTimestampUtc():O} -->");
                    Console.Out.WriteLine(xml);
                    Console.Out.WriteLine();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error parsing record {record.EventRecordId}: {ex.Message}");
                    continue;
                }

                count++;

                if (options.First > 0 && count >= options.First)
                    break;
            }

            if (options.First > 0 && count >= options.First)
                break;
        }

        return 0;
    }

    private static int ProcessTableFormat(EvtxFile file, CliOptions options)
    {
        List<TableRow> rows = new();
        int totalCount = 0;

        foreach (EvtxChunk chunk in file.Chunks)
        {
            foreach (EvtxEventRecord record in chunk.EventRecords)
            {
                if (!record.IsValid) continue;
                if (options.RecordId > 0 && record.EventRecordId != options.RecordId) continue;

                EventInfo parsedInfo = ExtractEventInfo(record, chunk);
                if (!MatchesFilters(parsedInfo, options)) continue;

                rows.Add(new TableRow(record, parsedInfo));
                totalCount++;

                if (options.First > 0 && totalCount >= options.First)
                    break;
            }

            if (options.First > 0 && totalCount >= options.First)
                break;
        }

        // Handle --last by taking only the tail
        if (options.Last > 0 && rows.Count > options.Last)
            rows = rows.TakeLast(options.Last).ToList();

        DisplayTable(rows, options);
        return 0;
    }

    private static void DisplayTable(List<TableRow> rows, CliOptions options)
    {
        const string fmt = "{0,-10} | {1,-23} | {2,-30} | {3,-8} | {4,-6} | {5,-20} | {6,-20}";
        string header = string.Format(fmt, "RecordID", "Timestamp", "Provider", "EventID", "Level", "Channel",
            "Computer");

        if (!options.NoColor)
            Console.ForegroundColor = ConsoleColor.Cyan;

        Console.Out.WriteLine(header);
        Console.Out.WriteLine(new string('-', header.Length));

        if (!options.NoColor)
            Console.ResetColor();

        foreach (TableRow row in rows)
        {
            string recordId = row.Record.EventRecordId.ToString();
            string timestamp = row.Record.GetTimestampUtc().ToString("yyyy-MM-dd HH:mm:ss.fff");
            string provider = Truncate(row.Info.ProviderName ?? "Unknown", 30);
            string eventId = row.Info.EventId ?? "?";
            string level = Truncate(row.Info.Level ?? "?", 6);
            string channel = Truncate(row.Info.Channel ?? "?", 20);
            string computer = Truncate(row.Info.Computer ?? "?", 20);

            Console.Out.WriteLine(fmt, recordId, timestamp, provider, eventId, level, channel, computer);
        }

        Console.Error.WriteLine();
        Console.Error.WriteLine($"Displayed {rows.Count} records");
    }

    private static string Truncate(string value, int maxLength)
    {
        if (value.Length <= maxLength) return value;
        return value[..(maxLength - 1)] + "~";
    }

    /// <summary>Check if a parsed event matches the CLI filter options.</summary>
    private static bool MatchesFilters(EventInfo parsedInfo, CliOptions options)
    {
        if (!string.IsNullOrEmpty(options.FilterProvider))
            if (!string.Equals(parsedInfo.ProviderName, options.FilterProvider, StringComparison.OrdinalIgnoreCase))
                return false;

        if (options.FilterEventId > 0)
            if (!uint.TryParse(parsedInfo.EventId, out uint eid) || eid != options.FilterEventId)
                return false;

        if (!string.IsNullOrEmpty(options.FilterLevel))
            if (!string.Equals(parsedInfo.Level, options.FilterLevel, StringComparison.OrdinalIgnoreCase))
                return false;

        return true;
    }

    /// <summary>Parse BinXml for an event record and extract structured event info.</summary>
    private static EventInfo ExtractEventInfo(EvtxEventRecord record, EvtxChunk chunk)
    {
        int recordOffset = FindRecordOffsetInChunk(chunk, record.EventRecordId);
        if (recordOffset < 0)
            return new EventInfo();

        try
        {
            int binXmlOffset = recordOffset + 24;
            BinXmlParser parser = new(chunk.RawData);
            List<BinXmlNode> nodes = parser.Parse(binXmlOffset);

            EventDataExtractor extractor = new();
            return extractor.Extract(nodes);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"  [debug] Record {record.EventRecordId} parse error: {ex.Message}");
            return new EventInfo();
        }
    }

    private static int FindRecordOffsetInChunk(EvtxChunk chunk, ulong targetRecordId)
    {
        int pos = EvtxChunkHeader.HeaderSize; // Records start after 512-byte header
        uint freeSpace = chunk.Header.FreeSpaceOffset;
        int endPos = (int)Math.Min(freeSpace, EvtxChunkHeader.ChunkSize);

        while (pos + 28 <= endPos)
        {
            uint sig = BitConverter.ToUInt32(chunk.RawData, pos);
            if (sig != EvtxEventRecord.ExpectedSignature)
                break;

            uint size = BitConverter.ToUInt32(chunk.RawData, pos + 4);
            if (size < 28 || pos + (int)size > endPos)
                break;

            ulong recordId = BitConverter.ToUInt64(chunk.RawData, pos + 8);
            if (recordId == targetRecordId)
                return pos;

            pos += (int)size;
        }

        return -1;
    }

    private static CliOptions ParseArguments(string[] args)
    {
        CliOptions options = new();

        for (int i = 0; i < args.Length; i++)
        {
            string arg = args[i];
            string argLower = arg.ToLower();

            switch (argLower)
            {
                case "--help":
                case "-h":
                case "-?":
                    options.ShowHelp = true;
                    break;

                case "--format":
                    if (i + 1 < args.Length)
                    {
                        options.Format = args[i + 1].ToLower() switch
                        {
                            "json" => OutputFormat.Json,
                            "xml" => OutputFormat.Xml,
                            "table" => OutputFormat.Table,
                            "summary" => OutputFormat.Summary,
                            _ => OutputFormat.Summary
                        };
                        i++;
                    }

                    break;

                case "--record-id":
                    if (i + 1 < args.Length && ulong.TryParse(args[i + 1], out ulong recordId))
                    {
                        options.RecordId = recordId;
                        i++;
                    }

                    break;

                case "--first":
                    if (i + 1 < args.Length && int.TryParse(args[i + 1], out int first))
                    {
                        options.First = first;
                        i++;
                    }

                    break;

                case "--last":
                    if (i + 1 < args.Length && int.TryParse(args[i + 1], out int last))
                    {
                        options.Last = last;
                        i++;
                    }

                    break;

                case "--filter-provider":
                    if (i + 1 < args.Length)
                    {
                        options.FilterProvider = args[i + 1];
                        i++;
                    }

                    break;

                case "--filter-event-id":
                    if (i + 1 < args.Length && uint.TryParse(args[i + 1], out uint eventId))
                    {
                        options.FilterEventId = eventId;
                        i++;
                    }

                    break;

                case "--filter-level":
                    if (i + 1 < args.Length)
                    {
                        options.FilterLevel = args[i + 1];
                        i++;
                    }

                    break;

                case "--no-color":
                    options.NoColor = true;
                    break;

                default:
                    if (!arg.StartsWith("--") && !arg.StartsWith("-")) options.FilePath = arg;
                    break;
            }
        }

        return options;
    }

    private static void PrintHelp()
    {
        Console.Out.WriteLine("""
                              CrossPlatEvtxParser - Cross-platform EVTX Event Log Parser

                              Usage: CrossPlatEvtxParser <file.evtx> [options]

                              Arguments:
                                <file.evtx>                      Path to the EVTX file to parse

                              Options:
                                --format <xml|json|table|summary>  Output format (default: summary)
                                    xml      Render each record's BinXml to formatted XML
                                    json     Output event data as JSON (one record per object)
                                    table    Display records in tabular format
                                    summary  Show file summary and record count by provider/event ID

                                --record-id <id>                   Show only the record with specified ID
                                --first <n>                        Show only the first N records
                                --last <n>                         Show only the last N records

                                --filter-provider <name>           Filter records by provider name
                                --filter-event-id <id>             Filter records by event ID
                                --filter-level <level>             Filter records by level (e.g., Information, Warning, Error)

                                --no-color                         Disable colored output (for table format)
                                --help                             Show this help message

                              Examples:
                                # Show file summary
                                CrossPlatEvtxParser System.evtx

                                # Show first 10 records in JSON format
                                CrossPlatEvtxParser System.evtx --format json --first 10

                                # Display records in table format
                                CrossPlatEvtxParser System.evtx --format table

                                # Filter by provider and event ID
                                CrossPlatEvtxParser System.evtx --filter-provider "Microsoft-Windows-Security-Auditing" --filter-event-id 4688

                                # Render specific record as XML
                                CrossPlatEvtxParser System.evtx --record-id 12345 --format xml
                              """);
    }
}

file record TableRow(EvtxEventRecord Record, EventInfo Info);

file class CliOptions
{
    public string FilePath { get; set; } = string.Empty;
    public OutputFormat Format { get; set; } = OutputFormat.Summary;
    public ulong RecordId { get; set; }
    public int First { get; set; }
    public int Last { get; set; }
    public string FilterProvider { get; set; } = string.Empty;
    public uint FilterEventId { get; set; }
    public string FilterLevel { get; set; } = string.Empty;
    public bool NoColor { get; set; }
    public bool ShowHelp { get; set; }
}

file enum OutputFormat
{
    Summary,
    Json,
    Xml,
    Table
}