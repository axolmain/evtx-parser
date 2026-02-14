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
// Touch results to prevent dead-code elimination
if (parser.TotalRecords < 0) Console.Write("");
return 0;