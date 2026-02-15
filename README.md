# EVTX Raw Dump

Browser-based parser for Windows Event Log (`.evtx`) files. Drop a file, get structured XML with full BinXml decoding, template tracking, and chunk-level validation.

## Usage

Drop an `.evtx` file onto the page (or click to browse). The parser reads the entire file client-side — nothing is uploaded.

Output includes:
- XML reconstruction from BinXml binary format
- Per-record metadata comments (offsets, sizes, timestamps)
- Per-chunk header comments (record ranges, checksums, flags)
- Summary header with template statistics and parse errors
- Pagination for large files (50/100/250/500 records per page)
- Copy to clipboard and download as `.xml`

## How It Works

### File Structure

```
EVTX File
├── File Header (4KB) — "ElfFile\0" magic, headerBlockSize at offset 40, flags at offset 120
└── Chunk[] (64KB each) — "ElfChnk\0" magic, scanned in 64KB steps from headerBlockSize
    ├── Chunk Header (512 bytes)
    │   ├── Record ID ranges, offsets, checksums, flags
    │   ├── 64 common string offsets (chunk-relative)
    │   └── 32 template pointers
    └── Record[] — from offset 512 to freeSpaceOffset
        ├── Record Header (24 bytes) — 0x2A2A magic, size, recordId, FILETIME timestamp
        ├── BinXml Payload (size - 28 bytes)
        └── Trailing Size Copy (4 bytes)
```

### BinXml Parsing Pipeline

```
parseBinXmlDocument  →  parseBinXmlFragment  →  parseTemplateInstance / parseElement
                                                         │
                                                    parseContent (recursive)
                                                    handles: values, substitutions,
                                                    nested elements, CDATA, char/entity refs
```

Most records use **template instances** (token `0x0C`): a reusable XML skeleton with numbered substitution slots filled by typed values. The definition appears inline on first use, then subsequent records back-reference it by chunk-relative offset.

## Architecture

```
src/
  parser/       Pure TypeScript — zero DOM, zero React. Testable, Worker-ready.
  worker/       Single Web Worker for off-main-thread parsing
  hooks/        React hooks bridging parser to UI state
  components/   React presentational + container components
```

### Parser layer

| File | Contents |
|---|---|
| `types.ts` | All interfaces: FileHeader, ChunkHeader, EvtxRecord, TemplateStats, etc. |
| `constants.ts` | HEX lookup, TOKEN, TOKEN_NAMES, VALUE_TYPE |
| `helpers.ts` | filetimeToIso, hexDump, hex32, xmlEscape, readName, formatGuid |
| `format.ts` | formatChunkHeaderComment, formatRecordComment |
| `binxml.ts` | Recursive descent BinXml parser (elements, templates, substitutions) |
| `evtx-file-header.ts` | File header parsing (magic validation, offsets, flags) |
| `evtx-chunk.ts` | Chunk header parsing, chunk validation, template preloading |
| `evtx-record.ts` | Record parsing, BinXml-to-XML event record extraction |
| `evtx-parser.ts` | Top-level `parseEvtx` entry point, chunk offset discovery |
| `xml-helper.ts` | Zero-allocation XML field extractor for parsed event XML |

### Hooks

| File | Purpose |
|---|---|
| `useEvtxParser.ts` | Parse lifecycle: idle → reading → parsing → done/error |
| `useEvtxParserHelpers.ts` | Worker management, `parseFileBuffer` bridge |
| `useFileLoader.ts` | File loading with IndexedDB caching |
| `usePagination.ts` | Page state, navigation, page size selection |

### Web Worker

Parsing runs off the main thread in a single Web Worker. The main thread reads the file into an `ArrayBuffer`, transfers it to the worker, and receives streamed record batches plus a final completion message.

| File | Purpose |
|---|---|
| `parse-worker.ts` | Worker entry point — runs `parseEvtx`, streams record batches back |

### Key Functions

| Function | Purpose |
|---|---|
| `parseEvtx` | Entry point. Scans chunks, parses records, builds output |
| `parseTemplateInstance` | Handles inline/back-ref template definitions + substitution values |
| `parseElement` | Reads element name, attributes, content, close tokens |
| `parseContent` | Inner loop for mixed content (values, substitutions, nested elements) |
| `renderSubstitutionValue` | Type-dispatched rendering of substitution values to XML text |
| `readName` | Reads a BinXmlName structure from a chunk-relative offset |

## Gotchas (Non-Obvious Format Details)

### 1. Inline Name Structures

OpenStartElement and Attribute tokens store the name structure **inline** immediately after the 4-byte `nameOffset` field. The `nameOffset` is a chunk-relative pointer to the name, but the name bytes are physically right there in the stream. You must skip past them:

```
nameOffset (4 bytes)     ← pointer to the structure below
├── unknown    (4 bytes)
├── hash       (2 bytes)
├── numChars   (2 bytes)
├── string     (numChars × 2 bytes, UTF-16LE)
└── null term  (2 bytes)
Total skip: 10 + numChars × 2
```

`readName(chunkDv, nameOffset)` resolves the name via the chunk DataView. But the parser cursor must also advance past the inline bytes, or everything after is misaligned.

### 2. Template Definition Header (+24 Offset)

The template definition at `defDataOffset` has a 24-byte header before the actual element tree:

```
[0-3]   next template definition offset (4 bytes)
[4-19]  GUID (16 bytes)
[20-23] dataSize (4 bytes) — size of body ONLY, not including this header
[24...] body data (fragment header + element tree)
```

When creating the template body view: `new Uint8Array(chunk, defDataOffset + 24, dataSize)`. **Not** `defDataOffset` — that gives you the header bytes, and `tplBytes[0]` would be `0x00` (first byte of next-ptr), which the parser reads as EOF.

### 3. `parseContent` Must Break on ATTRIBUTE Tokens

`parseContent` is called to parse attribute values (via `parseElement`). When the value is consumed (e.g., a single substitution), the next byte is the next attribute token (`0x06`). If ATTRIBUTE isn't in the break conditions, `parseContent` treats it as unexpected content and reads binary data as text — producing garbled Unicode output.

### 4. Embedded BinXml (Type 0x21)

Substitution values of type `0x21` contain a full nested BinXml document with its own template instance. When rendering these, you must pass:
- **`tplStats`** — so the nested template definitions get registered/looked up
- **`binxmlChunkBase`** — computed as `valueBytes.byteOffset - chunkDv.byteOffset`, so inline detection works (`defDataOffset === binxmlChunkBase + pos.offset`)

Without these, the nested template can't detect it's inline and falls back to a missing-definition error.

### 5. `defsByOffset` Must Reset Per Chunk

Template definition offsets are chunk-relative. If `defsByOffset` persists across chunks, offset `0x1A0` in chunk 2 would match chunk 0's cached definition — wrong GUID/dataSize metadata, even though `chunkDv` reads the correct bytes from the current chunk.

### 6. Value Type Array Flag (0x80)

Bit `0x80` means "array of base type". E.g., `0x81` = array of UTF-16 strings (null-terminated, concatenated). The base type is `valueType & 0x7F`. String arrays split on `\0`; fixed-size arrays chunk by element size.

### 7. Template Inline Detection

A template instance is inline when `defDataOffset === binxmlChunkBase + pos.offset` (i.e., the definition data starts right at the current cursor position in the chunk). For back-references, the offset points to a definition encountered earlier in the same chunk. The `binxmlChunkBase` must be correct for the current BinXml context — the record's BinXml payload offset for top-level, or the substitution value's position for embedded BinXml.

## File Format Constants

```
File header flags (offset 120):  0x01 = DIRTY, 0x02 = FULL
Chunk flags:                     0x01 = CORRUPTED
Event levels:                    1=Critical, 2=Error, 3=Warning, 4=Information, 5=Verbose
Token flag:                      0x40 = HAS_MORE_DATA
Value type flag:                 0x80 = ARRAY
```

## Development

```
npm install
npm run dev
```

## Scripts

- `npm run dev` — start dev server with hot reload
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build locally
- `npm test` — run unit/integration tests (watch mode)
- `npm run test:ci` — run all tests once
- `npm run lint` — TypeScript type-check + Biome lint
- `npm run format` — format with Biome

## Tech stack

- React 19, TypeScript 5, Vite 7
- Mantine v8
- Biome v2 (lint + format)
- Vitest 4 + Testing Library (unit/integration)
- Playwright (e2e)
