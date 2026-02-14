using EvtxParserWasm;

if (args.Length == 0) return 1;
byte[] data = File.ReadAllBytes(args[0]);
EvtxParser parser = EvtxParser.Parse(data);
// Touch results to prevent dead-code elimination
if (parser.TotalRecords < 0) Console.Write("");
return 0;