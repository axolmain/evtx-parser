# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 07:50:55 UTC |
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
| parseEvtx (full pipeline) | 25 | 404.91 | 392.59 | 460.51 | 402.09 |
| parseFileHeader | 3072152 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 298237 | 0.00 | 0.00 | 0.43 | 0.00 |
| parseChunk (all chunks) | 38 | 17.28 | 16.21 | 20.40 | 17.06 |
| parseEventRecord (all records) | 25 | 390.57 | 380.40 | 446.98 | 386.23 |
| preloadTemplateDefinitions (all chunks) | 32 | 20.51 | 18.95 | 25.03 | 20.38 |
| BinXmlParser.parseDocument (all records) | 25 | 215.70 | 210.64 | 240.44 | 213.37 |
| parseEventXml (all records) | 25 | 125.21 | 122.24 | 150.76 | 123.57 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 33 | 20.04 | 18.04 | 40.63 | 18.73 |
| parseFileHeader | 2769541 | 0.00 | 0.00 | 1.02 | 0.00 |
| discoverChunkOffsets | 1745321 | 0.00 | 0.00 | 71.50 | 0.00 |
| parseChunk (all chunks) | 450 | 1.34 | 1.27 | 3.70 | 1.31 |
| parseEventRecord (all records) | 32 | 20.06 | 18.43 | 25.61 | 19.19 |
| preloadTemplateDefinitions (all chunks) | 428 | 1.41 | 1.33 | 5.19 | 1.36 |
| BinXmlParser.parseDocument (all records) | 61 | 10.37 | 10.07 | 11.49 | 10.24 |
| parseEventXml (all records) | 96 | 6.43 | 6.29 | 7.50 | 6.39 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 319.13 | 307.67 | 449.75 | 312.06 |
| parseFileHeader | 2773026 | 0.00 | 0.00 | 2.75 | 0.00 |
| discoverChunkOffsets | 447174 | 0.00 | 0.00 | 0.64 | 0.00 |
| parseChunk (all chunks) | 31 | 21.10 | 20.47 | 22.22 | 20.91 |
| parseEventRecord (all records) | 25 | 316.45 | 308.77 | 384.65 | 312.90 |
| preloadTemplateDefinitions (all chunks) | 30 | 22.43 | 21.54 | 23.83 | 22.28 |
| BinXmlParser.parseDocument (all records) | 25 | 172.49 | 168.06 | 194.15 | 171.45 |
| parseEventXml (all records) | 25 | 100.89 | 99.07 | 117.11 | 100.08 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 762.13 | 733.75 | 895.17 | 741.84 |
| parseFileHeader | 2726204 | 0.00 | 0.00 | 2.57 | 0.00 |
| discoverChunkOffsets | 293309 | 0.00 | 0.00 | 0.57 | 0.00 |
| parseChunk (all chunks) | 25 | 41.27 | 40.24 | 45.85 | 40.94 |
| parseEventRecord (all records) | 25 | 751.26 | 733.91 | 803.13 | 747.08 |
| preloadTemplateDefinitions (all chunks) | 25 | 51.40 | 49.00 | 76.23 | 49.84 |
| BinXmlParser.parseDocument (all records) | 25 | 420.43 | 403.65 | 493.03 | 407.73 |
| parseEventXml (all records) | 25 | 244.22 | 230.51 | 308.39 | 233.97 |

