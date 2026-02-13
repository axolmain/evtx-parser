# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 05:37:11 UTC |
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
| parseEvtx (full pipeline) | 17 | 1285.45 | 1228.10 | 1868.08 | 1239.33 |
| parseFileHeader | 3137765 | 0.00 | 0.00 | 0.93 | 0.00 |
| discoverChunkOffsets | 290274 | 0.00 | 0.00 | 0.48 | 0.00 |
| parseChunk (all chunks) | 38 | 17.12 | 16.41 | 19.91 | 16.86 |
| parseEventRecord (all records) | 17 | 1237.45 | 1224.04 | 1264.62 | 1236.61 |
| preloadTemplateDefinitions (all chunks) | 34 | 19.69 | 18.91 | 23.47 | 19.27 |
| BinXmlParser.parseDocument (all records) | 17 | 1229.76 | 1062.80 | 2095.52 | 1085.35 |
| parseEventXml (all records) | 17 | 122.48 | 119.58 | 127.61 | 121.61 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 55.31 | 52.42 | 58.10 | 54.99 |
| parseFileHeader | 2740397 | 0.00 | 0.00 | 0.59 | 0.00 |
| discoverChunkOffsets | 1936199 | 0.00 | 0.00 | 0.56 | 0.00 |
| parseChunk (all chunks) | 450 | 1.34 | 1.28 | 2.25 | 1.32 |
| parseEventRecord (all records) | 17 | 56.61 | 52.33 | 71.13 | 55.01 |
| preloadTemplateDefinitions (all chunks) | 414 | 1.46 | 1.34 | 4.94 | 1.38 |
| BinXmlParser.parseDocument (all records) | 19 | 45.02 | 43.60 | 47.67 | 44.87 |
| parseEventXml (all records) | 99 | 6.31 | 6.10 | 7.82 | 6.17 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 907.44 | 851.85 | 1196.84 | 867.68 |
| parseFileHeader | 2805757 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 437419 | 0.00 | 0.00 | 0.71 | 0.00 |
| parseChunk (all chunks) | 30 | 22.92 | 21.45 | 32.34 | 22.54 |
| parseEventRecord (all records) | 17 | 872.61 | 849.46 | 909.86 | 873.02 |
| preloadTemplateDefinitions (all chunks) | 29 | 23.31 | 21.37 | 29.72 | 23.09 |
| BinXmlParser.parseDocument (all records) | 17 | 734.26 | 716.77 | 798.62 | 727.69 |
| parseEventXml (all records) | 17 | 98.06 | 96.41 | 109.37 | 97.25 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 2074.21 | 2002.92 | 2166.16 | 2069.94 |
| parseFileHeader | 2776697 | 0.00 | 0.00 | 0.02 | 0.00 |
| discoverChunkOffsets | 275912 | 0.00 | 0.00 | 11.30 | 0.00 |
| parseChunk (all chunks) | 20 | 40.73 | 39.52 | 42.54 | 40.79 |
| parseEventRecord (all records) | 17 | 2051.22 | 1962.34 | 2213.09 | 2046.78 |
| preloadTemplateDefinitions (all chunks) | 17 | 55.55 | 52.57 | 58.16 | 55.99 |
| BinXmlParser.parseDocument (all records) | 17 | 1758.00 | 1670.42 | 2181.16 | 1711.23 |
| parseEventXml (all records) | 17 | 233.16 | 224.95 | 240.02 | 233.94 |

