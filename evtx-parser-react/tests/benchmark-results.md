# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 06:04:03 UTC |
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
| parseEvtx (full pipeline) | 17 | 936.23 | 925.62 | 968.83 | 933.70 |
| parseFileHeader | 3081793 | 0.00 | 0.00 | 6.79 | 0.00 |
| discoverChunkOffsets | 291787 | 0.00 | 0.00 | 1.10 | 0.00 |
| parseChunk (all chunks) | 37 | 17.86 | 16.61 | 20.81 | 17.62 |
| parseEventRecord (all records) | 17 | 997.43 | 904.03 | 1345.61 | 940.45 |
| preloadTemplateDefinitions (all chunks) | 33 | 20.08 | 18.67 | 25.81 | 19.66 |
| BinXmlParser.parseDocument (all records) | 17 | 759.16 | 738.60 | 817.35 | 756.73 |
| parseEventXml (all records) | 17 | 131.30 | 123.95 | 192.84 | 127.13 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 19 | 42.16 | 39.17 | 46.63 | 40.90 |
| parseFileHeader | 2709088 | 0.00 | 0.00 | 1.33 | 0.00 |
| discoverChunkOffsets | 1841023 | 0.00 | 0.00 | 2.14 | 0.00 |
| parseChunk (all chunks) | 455 | 1.33 | 1.28 | 3.31 | 1.31 |
| parseEventRecord (all records) | 19 | 42.69 | 39.30 | 55.76 | 40.42 |
| preloadTemplateDefinitions (all chunks) | 436 | 1.39 | 1.33 | 6.73 | 1.35 |
| BinXmlParser.parseDocument (all records) | 23 | 31.98 | 30.92 | 33.95 | 31.47 |
| parseEventXml (all records) | 96 | 6.52 | 6.29 | 9.45 | 6.41 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 700.21 | 654.35 | 867.32 | 687.39 |
| parseFileHeader | 2537612 | 0.00 | 0.00 | 3.10 | 0.00 |
| discoverChunkOffsets | 433184 | 0.00 | 0.00 | 1.04 | 0.00 |
| parseChunk (all chunks) | 31 | 21.44 | 20.53 | 23.50 | 21.27 |
| parseEventRecord (all records) | 17 | 670.14 | 659.39 | 695.26 | 666.89 |
| preloadTemplateDefinitions (all chunks) | 21 | 35.65 | 26.82 | 39.28 | 36.26 |
| BinXmlParser.parseDocument (all records) | 17 | 525.63 | 510.23 | 627.06 | 516.31 |
| parseEventXml (all records) | 17 | 102.61 | 98.48 | 128.08 | 100.94 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 1587.15 | 1546.40 | 1727.30 | 1565.88 |
| parseFileHeader | 2713171 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 279951 | 0.00 | 0.00 | 1.26 | 0.00 |
| parseChunk (all chunks) | 19 | 42.31 | 41.21 | 46.23 | 41.89 |
| parseEventRecord (all records) | 17 | 1608.44 | 1541.23 | 1854.48 | 1594.56 |
| preloadTemplateDefinitions (all chunks) | 17 | 50.82 | 49.56 | 52.02 | 51.15 |
| BinXmlParser.parseDocument (all records) | 17 | 1216.29 | 1184.21 | 1419.35 | 1191.80 |
| parseEventXml (all records) | 17 | 239.97 | 233.79 | 307.85 | 235.13 |

