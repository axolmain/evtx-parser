# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 06:59:51 UTC |
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
| parseEvtx (full pipeline) | 25 | 400.18 | 388.03 | 487.37 | 395.98 |
| parseFileHeader | 3037875 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 296510 | 0.00 | 0.00 | 0.64 | 0.00 |
| parseChunk (all chunks) | 38 | 17.12 | 16.59 | 21.10 | 16.76 |
| parseEventRecord (all records) | 25 | 383.55 | 376.70 | 448.14 | 381.79 |
| preloadTemplateDefinitions (all chunks) | 34 | 19.82 | 18.92 | 27.19 | 19.16 |
| BinXmlParser.parseDocument (all records) | 25 | 209.31 | 206.33 | 211.57 | 209.54 |
| parseEventXml (all records) | 25 | 122.71 | 119.69 | 157.16 | 121.27 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 34 | 19.88 | 18.39 | 24.15 | 18.81 |
| parseFileHeader | 2775599 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 1956332 | 0.00 | 0.00 | 0.50 | 0.00 |
| parseChunk (all chunks) | 458 | 1.32 | 1.28 | 1.76 | 1.31 |
| parseEventRecord (all records) | 35 | 19.09 | 17.94 | 23.03 | 18.17 |
| preloadTemplateDefinitions (all chunks) | 434 | 1.39 | 1.35 | 3.88 | 1.37 |
| BinXmlParser.parseDocument (all records) | 57 | 11.08 | 9.84 | 16.52 | 10.25 |
| parseEventXml (all records) | 90 | 6.95 | 6.32 | 10.86 | 6.40 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 317.20 | 303.09 | 395.86 | 314.10 |
| parseFileHeader | 2592940 | 0.00 | 0.00 | 6.12 | 0.00 |
| discoverChunkOffsets | 450286 | 0.00 | 0.00 | 0.59 | 0.00 |
| parseChunk (all chunks) | 30 | 21.88 | 20.69 | 24.02 | 21.90 |
| parseEventRecord (all records) | 25 | 318.93 | 300.43 | 434.89 | 308.46 |
| preloadTemplateDefinitions (all chunks) | 30 | 21.91 | 21.31 | 23.56 | 21.68 |
| BinXmlParser.parseDocument (all records) | 25 | 169.07 | 166.89 | 172.71 | 168.43 |
| parseEventXml (all records) | 25 | 100.83 | 98.72 | 117.95 | 99.83 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 772.24 | 749.77 | 823.66 | 766.41 |
| parseFileHeader | 2761436 | 0.00 | 0.00 | 0.04 | 0.00 |
| discoverChunkOffsets | 297315 | 0.00 | 0.00 | 0.47 | 0.00 |
| parseChunk (all chunks) | 25 | 41.38 | 40.04 | 43.44 | 41.38 |
| parseEventRecord (all records) | 25 | 738.19 | 724.80 | 774.08 | 732.08 |
| preloadTemplateDefinitions (all chunks) | 25 | 50.13 | 48.45 | 52.57 | 49.85 |
| BinXmlParser.parseDocument (all records) | 25 | 402.74 | 394.58 | 406.41 | 403.07 |
| parseEventXml (all records) | 25 | 236.24 | 229.90 | 319.65 | 231.90 |

