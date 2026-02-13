# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 08:10:40 UTC |
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
| parseEvtx (full pipeline) | 25 | 391.92 | 378.24 | 488.72 | 384.18 |
| parseFileHeader | 3037917 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 295695 | 0.00 | 0.00 | 0.73 | 0.00 |
| parseChunk (all chunks) | 37 | 17.46 | 16.33 | 25.62 | 16.66 |
| parseEventRecord (all records) | 25 | 385.56 | 378.05 | 476.31 | 381.27 |
| preloadTemplateDefinitions (all chunks) | 32 | 23.10 | 18.72 | 103.16 | 20.58 |
| BinXmlParser.parseDocument (all records) | 25 | 210.18 | 205.90 | 232.45 | 209.19 |
| parseEventXml (all records) | 25 | 127.10 | 124.09 | 151.58 | 125.38 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 34 | 19.41 | 18.22 | 22.54 | 18.64 |
| parseFileHeader | 2705607 | 0.00 | 0.00 | 0.09 | 0.00 |
| discoverChunkOffsets | 1866243 | 0.00 | 0.00 | 1.29 | 0.00 |
| parseChunk (all chunks) | 454 | 1.33 | 1.27 | 1.94 | 1.30 |
| parseEventRecord (all records) | 34 | 19.72 | 18.17 | 23.97 | 18.85 |
| preloadTemplateDefinitions (all chunks) | 418 | 1.44 | 1.32 | 13.61 | 1.35 |
| BinXmlParser.parseDocument (all records) | 62 | 10.19 | 9.85 | 11.24 | 10.08 |
| parseEventXml (all records) | 96 | 6.48 | 6.31 | 7.49 | 6.40 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 322.84 | 306.76 | 445.48 | 313.01 |
| parseFileHeader | 2614380 | 0.00 | 0.00 | 0.13 | 0.00 |
| discoverChunkOffsets | 427945 | 0.00 | 0.00 | 1.01 | 0.00 |
| parseChunk (all chunks) | 28 | 23.46 | 20.69 | 37.59 | 22.45 |
| parseEventRecord (all records) | 25 | 315.84 | 306.30 | 391.75 | 312.12 |
| preloadTemplateDefinitions (all chunks) | 30 | 22.81 | 21.58 | 27.64 | 22.26 |
| BinXmlParser.parseDocument (all records) | 25 | 172.58 | 166.84 | 202.06 | 169.74 |
| parseEventXml (all records) | 25 | 101.47 | 98.91 | 120.93 | 100.31 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 752.51 | 727.78 | 821.26 | 741.77 |
| parseFileHeader | 2713633 | 0.00 | 0.00 | 0.76 | 0.00 |
| discoverChunkOffsets | 290154 | 0.00 | 0.00 | 0.66 | 0.00 |
| parseChunk (all chunks) | 25 | 42.41 | 40.54 | 64.58 | 41.34 |
| parseEventRecord (all records) | 25 | 753.43 | 733.99 | 803.06 | 748.37 |
| preloadTemplateDefinitions (all chunks) | 25 | 50.85 | 49.88 | 52.87 | 50.71 |
| BinXmlParser.parseDocument (all records) | 25 | 407.64 | 397.42 | 436.53 | 403.51 |
| parseEventXml (all records) | 25 | 237.95 | 232.05 | 293.37 | 233.83 |

### system-github.evtx (1.07 MB, 1,601 records, 9 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 28 | 24.63 | 23.45 | 27.90 | 23.74 |
| parseFileHeader | 2697045 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 1936243 | 0.00 | 0.00 | 1.32 | 0.00 |
| parseChunk (all chunks) | 400 | 1.51 | 1.45 | 2.35 | 1.50 |
| parseEventRecord (all records) | 28 | 24.87 | 23.32 | 27.92 | 23.88 |
| preloadTemplateDefinitions (all chunks) | 348 | 1.74 | 1.60 | 4.09 | 1.65 |
| BinXmlParser.parseDocument (all records) | 48 | 13.27 | 12.80 | 14.72 | 13.11 |
| parseEventXml (all records) | 77 | 8.10 | 7.91 | 10.30 | 8.00 |

