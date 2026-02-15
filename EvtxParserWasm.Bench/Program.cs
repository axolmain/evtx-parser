using EvtxParserWasm;

if (args.Length == 0) return 1;

int threads = 0; // default: all cores
for (int i = 1; i < args.Length; i++)
{
    if (args[i] == "-t" && i + 1 < args.Length)
        threads = int.Parse(args[++i]);
}

byte[] data = File.ReadAllBytes(args[0]);
EvtxParser parser = EvtxParser.Parse(data, threads);

// Write serialized XML to stdout (matches Rust evtx_dump default XML output)
using Stream stdout = Console.OpenStandardOutput();
using StreamWriter writer = new StreamWriter(stdout, bufferSize: 65536);
for (int index = 0; index < parser.Chunks.Count; index++)
{
    EvtxChunk chunk = parser.Chunks[index];
    for (int i = 0; i < chunk.ParsedXml.Length; i++)
    {
        string xml = chunk.ParsedXml[i];
        writer.Write(xml);
    }
}

writer.Flush();

return 0;