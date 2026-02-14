# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-14 05:58:20 UTC |
| **Node** | v25.6.0 |
| **Platform** | darwin arm64 |

## Test Files

| File | Size | Records | Chunks |
|------|------|---------|--------|
| Application.evtx | 20.07 MB | 17,474 | 312 |
| Cadwell.evtx | 1.07 MB | 1,388 | 11 |
| System.evtx | 20.07 MB | 42,007 | 315 |
| security_big_sample.evtx | 30.07 MB | 62,031 | 481 |

## Results

### Application.evtx (20.07 MB, 17,474 records, 312 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 235.01 | 176.49 | 565.65 | 202.33 |
| parseFileHeader | 6151360 | 0.00 | 0.00 | 0.90 | 0.00 |
| discoverChunkOffsets | 572586 | 0.00 | 0.00 | 0.46 | 0.00 |
| parseChunk (all chunks) | 165 | 3.72 | 3.55 | 7.18 | 3.60 |
| parseEventRecord (all records) | 25 | 208.91 | 173.39 | 329.34 | 194.35 |
| preloadTemplateDefinitions (all chunks) | 124 | 4.94 | 4.57 | 9.07 | 4.73 |
| BinXmlParser.parseDocument (all records) | 25 | 127.06 | 108.37 | 216.85 | 118.69 |
| parseEventXml (all records) | 25 | 43.11 | 39.22 | 76.66 | 41.64 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 68 | 9.17 | 6.44 | 16.81 | 7.76 |
| parseFileHeader | 5343930 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 3794137 | 0.00 | 0.00 | 0.57 | 0.00 |
| parseChunk (all chunks) | 2127 | 0.28 | 0.27 | 0.75 | 0.28 |
| parseEventRecord (all records) | 71 | 8.84 | 6.49 | 14.84 | 7.42 |
| preloadTemplateDefinitions (all chunks) | 1860 | 0.32 | 0.30 | 6.56 | 0.31 |
| BinXmlParser.parseDocument (all records) | 121 | 5.07 | 4.11 | 9.70 | 4.28 |
| parseEventXml (all records) | 404 | 1.50 | 1.45 | 4.47 | 1.47 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 360.59 | 322.45 | 572.23 | 342.89 |
| parseFileHeader | 5179859 | 0.00 | 0.00 | 4.43 | 0.00 |
| discoverChunkOffsets | 552259 | 0.00 | 0.00 | 0.74 | 0.00 |
| parseChunk (all chunks) | 72 | 8.66 | 8.16 | 10.76 | 8.59 |
| parseEventRecord (all records) | 25 | 348.19 | 320.97 | 473.71 | 334.02 |
| preloadTemplateDefinitions (all chunks) | 49 | 13.44 | 12.44 | 26.30 | 12.98 |
| BinXmlParser.parseDocument (all records) | 25 | 226.34 | 206.60 | 335.92 | 216.59 |
| parseEventXml (all records) | 25 | 75.55 | 62.05 | 212.18 | 66.22 |

### security_big_sample.evtx (30.07 MB, 62,031 records, 481 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 588.55 | 520.14 | 711.42 | 586.70 |
| parseFileHeader | 5350357 | 0.00 | 0.00 | 0.04 | 0.00 |
| discoverChunkOffsets | 366431 | 0.00 | 0.00 | 0.57 | 0.00 |
| parseChunk (all chunks) | 51 | 12.55 | 12.06 | 20.40 | 12.42 |
| parseEventRecord (all records) | 25 | 550.17 | 517.60 | 629.49 | 538.47 |
| preloadTemplateDefinitions (all chunks) | 43 | 15.43 | 14.24 | 25.50 | 14.83 |
| BinXmlParser.parseDocument (all records) | 25 | 325.59 | 301.81 | 377.74 | 317.66 |
| parseEventXml (all records) | 25 | 135.37 | 128.19 | 215.04 | 131.56 |

