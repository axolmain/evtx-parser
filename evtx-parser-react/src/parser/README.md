# Parser

```
parser/
├── binxml.ts      BinXmlParser class — binary XML token stream → XML string
├── constants.ts   Token IDs, value type IDs, hex lookup table
├── evtx.ts        Top-level EVTX parsing: file header, chunks, records
├── format.ts      Comment formatting for chunk headers and records
├── helpers.ts     Shared utilities: xmlEscape, formatGuid, hex32, readName, readUnicodeTextString
├── index.ts       Barrel exports
├── types.ts       All TypeScript interfaces
└── xml-helper.ts  XML string → structured fields (fast-xml-parser, stateless)
```

## Parse Pipeline

Entry point: `parseEvtx(buffer: ArrayBuffer)` in `evtx.ts`.

### 1. File Header — `parseFileHeader()`

Validates the `"ElfFile"` magic signature and reads header block size + flags.

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x0000 | 7 | Signature | `"ElfFile"` magic bytes |
| 0x0028 | 2 | Header Block Size | Typically 4096 — tells us where chunks start |
| 0x0078 | 4 | Flags | `0x01` = DIRTY, `0x02` = FULL |

### 2. Chunk Discovery — `discoverChunkOffsets()`

Scans the buffer at 64KB intervals starting after the file header, looking for `"ElfChnk"` signatures. Returns an array of byte offsets.

### 3. Template Stats Init

Creates a `TemplateStats` object that tracks template definitions and references across the entire parse. This is the parse-time audit trail — which templates exist, who uses them, and what went wrong.

| Field | Purpose |
|-------|---------|
| `defsByOffset` | Primary cache: chunk-relative offset → template definition. **Reset per chunk** since offsets are chunk-relative. |
| `definitions` | Same definitions keyed by GUID string. Deduplicates across offsets. |
| `definitionCount` | Unique templates discovered (by GUID). |
| `references` | Log of every template reference: record ID, offset, GUID, inline vs back-ref. |
| `referenceCount` | Total template references across all records. |
| `missingRefs` | References to template offsets not found in `defsByOffset` — parse failures. |
| `missingCount` | Count of missing references. |
| `parseErrors` | Records where BinXml parsing threw an exception. |
| `currentRecordId` | Mutable cursor so `binxml.ts` can tag errors with the originating record. |

### 4. Chunk Loop

For each chunk offset:

#### 4a. Parse Chunk Header — `parseChunkHeader()`

The chunk header (512 bytes) tracks which event records it contains, provides lookup caches for common strings and templates, and stores CRC32 checksums.

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x0000 | 8 | Signature | `"ElfChnk\0"` |
| 0x0008 | 8 | First Event Log Record # | uint64 |
| 0x0010 | 8 | Last Event Log Record # | uint64 |
| 0x0018 | 8 | First Event Record ID | uint64 |
| 0x0020 | 8 | Last Event Record ID | uint64 |
| 0x0028 | 4 | Header Size | Always 128 |
| 0x002C | 4 | Last Event Offset | Chunk-relative offset of last record |
| 0x0030 | 4 | Free Space Offset | Where free space begins |
| 0x0034 | 4 | Event Records CRC32 | Checksum of all event record data |
| 0x0038 | 64 | Reserved | Unknown / reserved bytes |
| 0x0078 | 4 | Flags | `0x01` = CORRUPTED |
| 0x007C | 4 | Header Checksum | CRC32 of bytes 0x00–0x77 |
| 0x0080 | 256 | Common String Offsets | 64 x uint32 — cached element/attribute name offsets |
| 0x0180 | 128 | Template Pointers | 32 x uint32 — chained hash table of template definition offsets |

The template pointer table is a **chained hash table** — each of the 32 entries is the head of a linked list. The first 4 bytes of each template definition (`next template def offset`) point to the next definition in the same hash bucket.

#### 4b. Parse Records — `parseChunk()` + `parseRecord()`

Walks the chunk from `recordsStart` to `freeSpaceOffset`, reading event records:

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x00 | 4 | Signature | `0x00002A2A` (`"**"`) |
| 0x04 | 4 | Size | Total record size in bytes |
| 0x08 | 8 | Record ID | uint64 |
| 0x10 | 8 | Timestamp | FILETIME (100ns intervals since 1601-01-01) |
| 0x18 | ... | BinXml Payload | `size - 28` bytes of Binary XML |
| last 4 | 4 | Size Copy | Must match Size field |

#### 4c. Preload Templates — `preloadTemplateDefinitions()`

Walks the 32-entry template pointer hash table, following chains, and populates `tplStats.defsByOffset` so that back-references in records can resolve without scanning forward.

#### 4d. Parse Event Records — `parseEventRecord()`

For each record, creates (or reuses) a `BinXmlParser` instance and calls `parser.parseDocument()` to convert the BinXml payload to an XML string, then passes that string through `parseEventXml()` to extract structured fields (eventId, level, provider, etc.).

## BinXml Document — `BinXmlParser` class

`BinXmlParser` is a class that holds chunk-level state as instance fields (`chunkDv`, `chunkHeader`, `tplStats`) so the 6 mutually-recursive parse methods don't need to thread them as parameters. One instance is constructed per chunk and reused across all records in that chunk.

Static `TextDecoder` instances (`utf16`, `ascii`) are shared across all parser instances to avoid repeated allocations.

### Token → Method Mapping

| Component | Token(s) | Method | What it does |
|-----------|----------|--------|--------------|
| Document | `0x00` EOF, `0x0A` PITarget | `parseDocument()` | Top-level loop — dispatches fragments and processing instructions |
| Fragment Header | `0x0F` | `parseFragment()` | Consumes 4-byte header, dispatches to `parseTemplateInstance` or `parseElement` |
| Element | `0x01`/`0x41` Open, `0x02` CloseStart, `0x03` CloseEmpty, `0x04` End | `parseElement()` | Reads name offset, inline name, attributes, open/close/empty tags |
| Content | `0x05` Value, `0x07` CDATA, `0x08` CharRef, `0x09` EntityRef, `0x0D`/`0x0E` Substitutions | `parseContent()` | Handles all tokens that appear between open and close tags |
| Template Instance | `0x0C` | `parseTemplateInstance()` | Reads def (inline or back-ref), value descriptors, renders substitutions, then parses the template body |
| Substitution Values | — | `renderSubstitutionValue()` | Converts raw bytes + type code → string for all 20+ value types |
| Name Lookup | — | `readName()` | Reads UTF-16LE string at a chunk-relative offset |

### Call Flow (typical record)

```
parseDocument()
  └─ parseFragment()                    consume 0x0F + 3 bytes
       └─ parseTemplateInstance()        read def, read value descriptors
            ├─ renderSubstitutionValue() per substitution slot
            │    └─ parseDocument()      recursive for embedded BinXml (type 0x21)
            └─ parseContent()            walk the template body
                 ├─ parseElement()       per XML element
                 │    ├─ readName()      element/attribute name lookup
                 │    └─ parseContent()  recursive for child content
                 └─ subs[id].rendered    inline lookup for substitution tokens
```

### Inline Name Structures

Element and attribute tokens store a 4-byte `nameOffset` pointing to a chunk-relative name structure. When the name is **defined for the first time** (`nameOffset === binxmlChunkBase + currentPos`), the name structure bytes appear inline after the offset field. On subsequent references (back-references), only the 4-byte offset is present. When inline bytes are present, skip: `4 unknown + 2 hash + 2 numChars + numChars*2 string + 2 null` = `10 + numChars*2` bytes.

### Template Definitions

Each template definition has a 24-byte header before the body:

| Size | Field |
|------|-------|
| 4 | Next template def offset (linked list pointer) |
| 16 | Template GUID |
| 4 | Data size (body only, excludes this 24-byte header) |

The body is a BinXml fragment containing the XML skeleton with substitution placeholders.

### Value Types

Substitution values are typed. The type byte determines how `renderSubstitutionValue()` decodes the raw bytes:

| Code | Type | Code | Type |
|------|------|------|------|
| 0x00 | NULL | 0x0B | FLOAT |
| 0x01 | STRING (UTF-16LE) | 0x0C | DOUBLE |
| 0x02 | ANSI_STRING | 0x0D | BOOL |
| 0x03 | INT8 | 0x0E | BINARY (hex) |
| 0x04 | UINT8 | 0x0F | GUID |
| 0x05 | INT16 | 0x10 | SIZE |
| 0x06 | UINT16 | 0x11 | FILETIME |
| 0x07 | INT32 | 0x12 | SYSTEMTIME |
| 0x08 | UINT32 | 0x13 | SID |
| 0x09 | INT64 | 0x14 | HEX32 |
| 0x0A | UINT64 | 0x15 | HEX64 |
| | | 0x21 | BINXML (nested) |

Bit `0x80` on the type byte means **array of base type** (e.g., `0x81` = array of UTF-16LE strings). String arrays are null-terminated UTF-16LE concatenated; fixed-size arrays are decoded element by element.

## XML Field Extraction — `parseEventXml()`

`xml-helper.ts` is a stateless module (static service pattern) that takes the XML string produced by `BinXmlParser` and extracts structured fields using `fast-xml-parser`. It pulls out `eventId`, `level`, `provider`, `computer`, `channel`, and other System fields, plus flattened `EventData`/`UserData` content. This is the step that turns raw XML into the columns shown in the table view.
