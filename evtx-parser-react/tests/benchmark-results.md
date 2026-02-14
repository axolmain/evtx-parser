# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-14 09:58:15 UTC |
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
| parseEvtx (full pipeline) | 25 | 501.52 | 448.53 | 907.67 | 477.76 |
| parseFileHeader | 5642790 | 0.00 | 0.00 | 1.20 | 0.00 |
| discoverChunkOffsets | 431577 | 0.00 | 0.00 | 1.67 | 0.00 |
| parseChunk (all chunks) | 120 | 5.16 | 4.14 | 7.64 | 4.95 |
| parseEventRecord (all records) | 25 | 624.96 | 480.98 | 1102.25 | 578.45 |
| preloadTemplateDefinitions (all chunks) | 89 | 7.05 | 5.82 | 11.66 | 6.68 |
| BinXmlParser.parseDocument (all records) | 25 | 574.87 | 423.31 | 1115.49 | 456.53 |
| parseEventXml (all records) | 25 | 46.67 | 41.48 | 112.03 | 43.33 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 33 | 20.35 | 18.46 | 24.00 | 19.69 |
| parseFileHeader | 3903485 | 0.00 | 0.00 | 15.84 | 0.00 |
| discoverChunkOffsets | 2388128 | 0.00 | 0.00 | 1.93 | 0.00 |
| parseChunk (all chunks) | 1190 | 0.50 | 0.44 | 3.27 | 0.45 |
| parseEventRecord (all records) | 26 | 37.16 | 27.05 | 88.74 | 32.67 |
| preloadTemplateDefinitions (all chunks) | 1229 | 0.49 | 0.44 | 3.83 | 0.46 |
| BinXmlParser.parseDocument (all records) | 32 | 20.81 | 18.88 | 23.23 | 21.04 |
| parseEventXml (all records) | 305 | 1.99 | 1.82 | 4.36 | 1.95 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 1257.16 | 918.83 | 1836.65 | 1261.00 |
| parseFileHeader | 3470993 | 0.00 | 0.00 | 0.12 | 0.00 |
| discoverChunkOffsets | 347188 | 0.00 | 0.00 | 1.10 | 0.00 |
| parseChunk (all chunks) | 34 | 19.83 | 13.15 | 45.66 | 16.88 |
| parseEventRecord (all records) | 25 | 1484.09 | 995.60 | 2686.40 | 1247.70 |
| preloadTemplateDefinitions (all chunks) | 28 | 24.56 | 21.11 | 28.64 | 24.43 |
| BinXmlParser.parseDocument (all records) | 25 | 780.06 | 566.06 | 2504.70 | 632.75 |
| parseEventXml (all records) | 25 | 68.49 | 62.27 | 155.48 | 64.71 |

### security_big_sample.evtx (30.07 MB, 62,031 records, 481 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 25 | 1665.08 | 1409.11 | 2706.11 | 1543.72 |
| parseFileHeader | 4003466 | 0.00 | 0.00 | 8.69 | 0.00 |
| discoverChunkOffsets | 212671 | 0.00 | 0.00 | 1.68 | 0.00 |
| parseChunk (all chunks) | 36 | 18.53 | 16.65 | 28.98 | 18.13 |
| parseEventRecord (all records) | 25 | 1966.29 | 1433.20 | 3677.35 | 1698.60 |
| preloadTemplateDefinitions (all chunks) | 38 | 17.11 | 16.17 | 19.87 | 16.93 |
| BinXmlParser.parseDocument (all records) | 25 | 1321.48 | 1152.96 | 2119.30 | 1255.14 |
| parseEventXml (all records) | 25 | 218.26 | 139.41 | 418.97 | 166.53 |

