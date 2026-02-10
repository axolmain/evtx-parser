# Architecture

## Project Layout

```
CrossPlatEvtxParser/
  Models/
    FileHeader.cs      EvtxFileHeader     - 4096-byte file header
    ChunkHeader.cs     EvtxChunkHeader    - 512-byte chunk header
    EventRecord.cs     EvtxEventRecord    - Variable-length event record
    EvtxChunk.cs       EvtxChunk          - One 64KB chunk (header + records + raw bytes)
    EvtxFile.cs        EvtxFile           - Top-level container
  Parsing/
    EvtxReader.cs      EvtxReader         - Reads file, produces EvtxFile
    Crc32.cs           Crc32              - CRC32 checksum (RFC 1952)
  BinXml/
    BinXmlToken.cs     BinXmlTokenType    - Token byte constants
    BinXmlValueType.cs BinXmlValueType    - Value type byte constants
    BinXmlNodes.cs     BinXmlNode + subs  - IR node classes
    BinXmlParser.cs    BinXmlParser       - Parses binary XML from chunk bytes
  Rendering/
    XmlRenderer.cs     XmlRenderer        - Nodes -> XML string
    EventDataExtractor.cs                 - Nodes -> EventInfo (structured data)
  Program.cs                              - CLI entry point
```

## Data Flow

```
EVTX File on disk
    |
    v
EvtxReader.ReadFile(path)
    |
    +--> Reads 4096-byte file header -> EvtxFileHeader
    |
    +--> For each 65536-byte chunk:
    |      |
    |      +--> Parse 512-byte chunk header -> EvtxChunkHeader
    |      |      Includes: CommonStringOffsets[64], TemplatePointers[32]
    |      |
    |      +--> Store full 65536 bytes as chunk.RawData
    |      |
    |      +--> Scan records starting at offset 512:
    |             Read signature(4) + size(4) + id(8) + timestamp(8) + binxml(variable) + size_copy(4)
    |             -> List<EvtxEventRecord>
    |
    v
EvtxFile { Header, Chunks[] }
    |
    v
Program iterates chunks -> records, for each record:
    |
    +--> FindRecordOffsetInChunk(chunk, recordId) -> int offset
    |      Scans chunk.RawData from offset 512 matching on record signature + id
    |
    +--> BinXmlParser(chunk.RawData).Parse(recordOffset + 24)
    |      Parses binary XML tokens -> List<BinXmlNode>
    |
    +--> EventDataExtractor.Extract(nodes) -> EventInfo
    |      Walks node tree extracting Provider, EventID, Level, etc.
    |
    +--> XmlRenderer.Render(nodes) -> string (for --format xml)
```

## Key Design Decision

**BinXmlParser takes chunk.RawData (all 65536 bytes), not just the record's BinaryXmlData.**

Why: Element names and template definitions are referenced by offset from chunk start. A name at offset 0x300 in the
chunk might be shared by many records. Templates at offset 0x1000 are reused. The parser must be able to jump anywhere
in the chunk.

The `startOffset` parameter to `Parse()` is `recordOffset + 24` (skip the 24-byte record header to reach the BinXml
payload).

## Record Layout in a Chunk

```
Chunk (65536 bytes):
  [0x000 - 0x1FF]  Chunk Header (512 bytes)
  [0x200 - ...]     Event Records (variable, up to FreeSpaceOffset)
  [FreeSpaceOffset - 0xFFFF]  Unused

Each record:
  Offset  Size  Field
  0       4     Signature: 0x2A 0x2A 0x00 0x00
  4       4     Size (total including header and trailing size)
  8       8     EventRecordId
  16      8     Timestamp (FILETIME)
  24      var   Binary XML payload  <-- this is where BinXmlParser starts
  Size-4  4     Size copy (must equal Size)
```
