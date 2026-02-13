# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 08:35:04 UTC |
| **Node** | v25.6.0 |
| **Platform** | darwin arm64 |

## Test Files

| File | Size | Records | Chunks |
|------|------|---------|--------|
| Application.evtx | 20.07 MB | 17,474 | 312 |
| Cadwell.evtx | 1.07 MB | 1,388 | 11 |
| ForSeb.evtx | 13.07 MB | 21,940 | 201 |
| System.evtx | 20.07 MB | 42,007 | 315 |
| system-github.evtx | 1.07 MB | 1,601 | 9 |

## Results

### Application.evtx (20.07 MB, 17,474 records, 312 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 309.66 | 296.16 | 401.83 | 303.72 |
| parseFileHeader | 3196938 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 298485 | 0.00 | 0.00 | 0.67 | 0.00 |
| parseChunk (all chunks) | 86 | 7.26 | 6.68 | 13.82 | 6.84 |
| parseEventRecord (all records) | 25 | 311.51 | 299.98 | 407.99 | 305.71 |
| preloadTemplateDefinitions (all chunks) | 61 | 10.52 | 8.72 | 87.35 | 8.91 |
| BinXmlParser.parseDocument (all records) | 25 | 188.47 | 174.23 | 364.79 | 175.97 |
| parseEventXml (all records) | 25 | 86.33 | 75.06 | 132.90 | 78.43 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 48 | 13.52 | 12.11 | 17.23 | 12.67 |
| parseFileHeader | 2743472 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 1948441 | 0.00 | 0.00 | 0.96 | 0.00 |
| parseChunk (all chunks) | 1116 | 0.54 | 0.51 | 1.31 | 0.53 |
| parseEventRecord (all records) | 44 | 14.45 | 12.31 | 30.89 | 12.86 |
| preloadTemplateDefinitions (all chunks) | 1001 | 0.60 | 0.57 | 3.06 | 0.58 |
| BinXmlParser.parseDocument (all records) | 77 | 8.09 | 7.74 | 8.99 | 7.98 |
| parseEventXml (all records) | 211 | 2.90 | 2.79 | 3.96 | 2.86 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 224.47 | 216.34 | 309.46 | 219.19 |
| parseFileHeader | 2704459 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 445354 | 0.00 | 0.00 | 0.71 | 0.00 |
| parseChunk (all chunks) | 72 | 8.67 | 8.11 | 13.73 | 8.45 |
| parseEventRecord (all records) | 25 | 229.58 | 218.49 | 295.97 | 223.74 |
| preloadTemplateDefinitions (all chunks) | 67 | 9.39 | 8.79 | 11.32 | 9.15 |
| BinXmlParser.parseDocument (all records) | 25 | 133.80 | 130.99 | 135.37 | 133.58 |
| parseEventXml (all records) | 25 | 46.61 | 45.03 | 65.57 | 45.76 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 566.86 | 547.56 | 639.26 | 558.78 |
| parseFileHeader | 2641788 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 295578 | 0.00 | 0.00 | 0.42 | 0.00 |
| parseChunk (all chunks) | 37 | 17.34 | 15.51 | 35.42 | 16.54 |
| parseEventRecord (all records) | 25 | 554.77 | 544.89 | 608.70 | 551.92 |
| preloadTemplateDefinitions (all chunks) | 26 | 25.72 | 24.28 | 28.61 | 25.88 |
| BinXmlParser.parseDocument (all records) | 25 | 334.83 | 330.52 | 361.05 | 333.85 |
| parseEventXml (all records) | 25 | 123.84 | 119.49 | 181.95 | 120.81 |

### system-github.evtx (1.07 MB, 1,601 records, 9 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 34 | 18.97 | 16.61 | 41.17 | 17.27 |
| parseFileHeader | 2572530 | 0.00 | 0.00 | 0.71 | 0.00 |
| discoverChunkOffsets | 1955783 | 0.00 | 0.00 | 0.62 | 0.00 |
| parseChunk (all chunks) | 975 | 0.62 | 0.59 | 2.31 | 0.60 |
| parseEventRecord (all records) | 36 | 18.27 | 16.57 | 22.16 | 17.19 |
| preloadTemplateDefinitions (all chunks) | 795 | 0.76 | 0.73 | 2.34 | 0.74 |
| BinXmlParser.parseDocument (all records) | 57 | 11.14 | 10.33 | 17.00 | 10.75 |
| parseEventXml (all records) | 157 | 3.92 | 3.72 | 6.81 | 3.84 |

