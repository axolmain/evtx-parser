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

## Architecture

```
src/
  parser/       Pure TypeScript — zero DOM, zero React. Testable, Worker-ready.
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
| `evtx.ts` | File/chunk/record parsing, chunk validation, top-level parseEvtx |

### Hooks

| File | Purpose |
|---|---|
| `useEvtxParser.ts` | Parse lifecycle: idle → reading → parsing → done/error |
| `usePagination.ts` | Page state, navigation, page size selection |

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
- Tailwind CSS v4
- Biome v2 (lint + format)
- Vitest 4 + Testing Library (unit/integration)
- Playwright (e2e)
