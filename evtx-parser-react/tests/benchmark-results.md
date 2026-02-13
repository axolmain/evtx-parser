# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 06:46:04 UTC |
| **Node** | v25.6.0 |
| **Platform** | darwin arm64 |

## Test Files

| File | Size | Records | Chunks |
|------|------|---------|--------|
| Application.evtx | 20.07 MB | 17,474 | 312 |
| Cadwell.evtx | 1.07 MB | 1,388 | 11 |
| ForSeb.evtx | 13.07 MB | 21,940 | 201 |
| System.evtx | 20.07 MB | 42,007 | 315 |

## Results

### Application.evtx (20.07 MB, 17,474 records, 312 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 940.43 | 914.06 | 1229.45 | 921.33 |
| parseFileHeader | 3065607 | 0.00 | 0.00 | 0.78 | 0.00 |
| discoverChunkOffsets | 295068 | 0.00 | 0.00 | 0.74 | 0.00 |
| parseChunk (all chunks) | 36 | 18.24 | 16.67 | 22.15 | 18.09 |
| parseEventRecord (all records) | 25 | 907.86 | 889.18 | 933.52 | 906.13 |
| preloadTemplateDefinitions (all chunks) | 33 | 20.46 | 18.60 | 43.56 | 19.02 |
| BinXmlParser.parseDocument (all records) | 25 | 723.14 | 711.28 | 738.62 | 721.97 |
| parseEventXml (all records) | 25 | 128.21 | 122.61 | 182.48 | 125.65 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 42.07 | 38.85 | 47.46 | 40.24 |
| parseFileHeader | 2717939 | 0.00 | 0.00 | 0.08 | 0.00 |
| discoverChunkOffsets | 1899672 | 0.00 | 0.00 | 1.35 | 0.00 |
| parseChunk (all chunks) | 459 | 1.32 | 1.28 | 2.05 | 1.30 |
| parseEventRecord (all records) | 25 | 39.74 | 37.83 | 42.02 | 39.38 |
| preloadTemplateDefinitions (all chunks) | 439 | 1.38 | 1.33 | 3.04 | 1.36 |
| BinXmlParser.parseDocument (all records) | 26 | 30.74 | 29.71 | 31.58 | 30.87 |
| parseEventXml (all records) | 97 | 6.44 | 6.27 | 7.78 | 6.38 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 651.19 | 644.95 | 672.34 | 649.55 |
| parseFileHeader | 2692123 | 0.00 | 0.00 | 3.00 | 0.00 |
| discoverChunkOffsets | 426881 | 0.00 | 0.00 | 1.39 | 0.00 |
| parseChunk (all chunks) | 31 | 21.49 | 20.48 | 23.87 | 21.32 |
| parseEventRecord (all records) | 25 | 654.22 | 636.39 | 820.23 | 644.90 |
| preloadTemplateDefinitions (all chunks) | 30 | 22.25 | 21.27 | 24.41 | 22.35 |
| BinXmlParser.parseDocument (all records) | 25 | 499.56 | 487.87 | 527.64 | 497.60 |
| parseEventXml (all records) | 25 | 103.48 | 100.15 | 126.66 | 101.27 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 1564.07 | 1514.92 | 1732.55 | 1555.09 |
| parseFileHeader | 2722897 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 294026 | 0.00 | 0.00 | 0.87 | 0.00 |
| parseChunk (all chunks) | 25 | 41.08 | 39.65 | 42.66 | 41.11 |
| parseEventRecord (all records) | 25 | 1530.09 | 1494.01 | 1677.93 | 1517.86 |
| preloadTemplateDefinitions (all chunks) | 25 | 51.43 | 48.77 | 66.68 | 50.30 |
| BinXmlParser.parseDocument (all records) | 25 | 1201.30 | 1147.84 | 1495.75 | 1163.58 |
| parseEventXml (all records) | 25 | 250.24 | 232.77 | 413.39 | 236.70 |

