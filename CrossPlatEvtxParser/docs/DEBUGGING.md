# Debugging Guide

## The Current Problem

All records show `Unknown | ? | ? | ? | ?` for Provider/EventID/Level/Channel/Computer.

RecordID and Timestamp work because they come from the 24-byte record header (parsed in EvtxReader), not from BinXml.
Everything else requires successful BinXml parsing + EventDataExtractor, which is failing silently.

The `[debug]` line in Program.cs stderr output will show the actual exception. If you see parse errors, the BinXml
parser is crashing. If you see NO errors but still get "Unknown", the parser returns nodes but EventDataExtractor can't
find the expected structure.

## Most Likely Root Cause: Template Instance Parsing

Almost every EVTX record uses a TemplateInstance (token 0x0C). If template parsing is wrong, nothing downstream works.

### What to check in BinXmlParser.ParseTemplateInstance():

**1. Instance header size**

The template instance header after the 0x0C token is:

```
[unknown:1] [templateDefOffset:4]
```

That's 5 bytes total. If the code reads more bytes here (e.g., an extra uint32 for "nextTemplateOffset"), the stream
position is wrong and everything after is garbage.

**Verify:** After reading the instance header, `_pos` should be exactly 5 bytes past where the 0x0C token was.

**2. Template definition structure**

At templateDefOffset in the chunk, the data is:

```
[nextTemplateDefOffset:4] [guid:16] [dataSize:4] [binxml_content:variable]
```

If ParseTemplateDefinitionInline() skips the first 4 bytes (nextTemplateDefOffset) and reads the GUID starting at byte
0, the GUID will be wrong and the dataSize will be wrong, causing ParseFragment() to read garbage.

**Verify:** `_pos` after jumping to templateDefOffset should read a uint32 first (nextTemplateDefOffset), THEN the
16-byte GUID.

**3. Position after inline template definition**

For the FIRST record using a given template, the template definition is inline in the event stream. After parsing it,
`_pos` must land at the substitution data. If `_pos` is saved/restored (jumping back to before the template def), the
substitution count will be read from the wrong location.

For SUBSEQUENT records, the template is cached and `_pos` stays right after the 5-byte instance header, which is already
at the substitution data (no inline template def).

**Verify:** After ParseTemplateDefinitionInline(), `_pos` should NOT be restored. It should remain at the byte right
after the template definition's EOF token.

## How to Hex-Dump and Manually Inspect

Add this diagnostic to Program.cs to dump the first record's raw BinXml bytes:

```csharp
var chunk = file.Chunks[0];
var record = chunk.EventRecords[0];
int offset = FindRecordOffsetInChunk(chunk, record.EventRecordId);
int binXmlStart = offset + 24;

// Dump first 200 bytes of BinXml
Console.Error.WriteLine($"Record {record.EventRecordId} BinXml at chunk offset 0x{binXmlStart:X}:");
for (int i = 0; i < Math.Min(200, (int)record.Size - 28); i++)
{
    if (i % 16 == 0) Console.Error.Write($"\n  {binXmlStart + i:X4}: ");
    Console.Error.Write($"{chunk.RawData[binXmlStart + i]:X2} ");
}
Console.Error.WriteLine();
```

### What you should see:

```
  0218: 0F 01 01 00 0C 01 XX XX XX XX ...
        ^^ ^^ ^^ ^^ ^^ ^^
        |  |  |  |  |  |
        |  |  |  |  |  unknown byte (0x01)
        |  |  |  |  TemplateInstance token (0x0C)
        |  |  |  flags (0x00)
        |  |  minor version (0x01)
        |  major version (0x01)
        FragmentHeader token (0x0F)
```

After 0x0C 0x01, the next 4 bytes are the templateDefOffset (little-endian uint32).

Jump to that offset in the chunk and you should see:

```
  [XX XX XX XX]  nextTemplateDefOffset (4 bytes)
  [XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX]  GUID (16 bytes)
  [XX XX XX XX]  dataSize (4 bytes)
  [0F 01 01 00]  FragmentHeader inside template (should be 0x0F 0x01 0x01 0x00)
  [01 or 41]     OpenStartElement token
  ...
```

If the FragmentHeader (0x0F 0x01 0x01 0x00) appears at offset+24 (4+16+4=24 bytes after the templateDefOffset), the
template definition structure is correct.

If it appears at offset+20 or some other position, the parser is reading the wrong number of bytes before the fragment.

## Quick Test: Bypass Templates

To test if the issue is specifically template parsing, try parsing a record that does NOT use templates (rare, but you
can check). Or, add a debug line in ParseFragment():

```csharp
private List<BinXmlNode> ParseFragment()
{
    var nodes = new List<BinXmlNode>();
    while (_pos < _chunkData.Length)
    {
        if (!TryReadByte(out byte tokenByte)) break;
        var token = (BinXmlTokenType)tokenByte;

        Console.Error.WriteLine($"    Token 0x{tokenByte:X2} ({token}) at offset 0x{_pos - 1:X}");

        if (token == BinXmlTokenType.EOF) break;
        var node = ParseToken(token);
        if (node != null) nodes.Add(node);
    }
    return nodes;
}
```

This will print every token as it's parsed. You should see:

```
    Token 0x0F (FragmentHeader) at offset 0x218
    Token 0x0C (TemplateInstance) at offset 0x21C
```

If you then see the parser entering the template definition and printing:

```
    Token 0x0F (FragmentHeader) at offset 0x???   <-- inside template
    Token 0x01 (OpenStartElement) at offset 0x???
    Token 0x06 (Attribute) at offset 0x???
    ...
    Token 0x00 (EOF) at offset 0x???              <-- end of template
```

...then the template definition parsed successfully. The substitution values are read next (no tokens, just raw bytes
based on descriptors).

If instead you see unknown tokens or the offset jumps to something unexpected, the template offset or structure is
wrong.

## Checklist

1. [ ] Check stderr for `[debug] Record N parse error:` messages
2. [ ] Hex-dump first record's BinXml bytes — does it start with `0F 01 01 00 0C 01`?
3. [ ] Find the templateDefOffset (bytes 6-9 of BinXml, little-endian)
4. [ ] Check chunk data at that offset — does it have nextOffset(4) + GUID(16) + dataSize(4) + FragmentHeader(0x0F)?
5. [ ] Add token tracing to ParseFragment() and verify the token sequence makes sense
6. [ ] Verify ParseTemplateDefinitionInline reads nextOffset before GUID
7. [ ] Verify _pos is NOT restored after inline template parsing (first encounter)
8. [ ] Verify _pos IS left alone for cached templates (subsequent encounters)

## Reference Implementations

If you get stuck, these are solid reference parsers to compare byte-level behavior:

- **Rust**: https://github.com/omerbenamram/evtx (src/binxml/)
- **Python**: https://github.com/williballenthin/python-evtx
- **Python (writer)**: https://github.com/JPCERTCC/xml2evtx — useful for understanding the exact byte layout since it
  WRITES evtx files
