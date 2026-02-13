# Parser Benchmark Results

| Field | Value |
|-------|-------|
| **Version** | 0.0.0 |
| **Date** | 2026-02-13 05:17:53 UTC |
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
| parseEvtx (full pipeline) | 17 | 2575.79 | 2427.59 | 3736.72 | 2457.23 |
| parseFileHeader | 3201460 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 285211 | 0.00 | 0.00 | 0.45 | 0.00 |
| parseChunk (all chunks) | 38 | 17.29 | 16.60 | 21.66 | 16.96 |
| parseEventRecord (all records) | 17 | 2507.29 | 2411.17 | 3070.12 | 2464.34 |

### Cadwell.evtx (1.07 MB, 1,388 records, 11 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 109.33 | 105.51 | 120.27 | 108.10 |
| parseFileHeader | 2810560 | 0.00 | 0.00 | 0.06 | 0.00 |
| discoverChunkOffsets | 1956332 | 0.00 | 0.00 | 5.65 | 0.00 |
| parseChunk (all chunks) | 459 | 1.32 | 1.29 | 1.65 | 1.31 |
| parseEventRecord (all records) | 17 | 102.75 | 99.59 | 107.94 | 102.22 |

### ForSeb.evtx (13.07 MB, 21,940 records, 201 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 1853.20 | 1665.27 | 3056.18 | 1727.27 |
| parseFileHeader | 2702075 | 0.00 | 0.00 | 3.36 | 0.00 |
| discoverChunkOffsets | 438525 | 0.00 | 0.00 | 0.48 | 0.00 |
| parseChunk (all chunks) | 27 | 30.18 | 21.96 | 75.98 | 26.93 |
| parseEventRecord (all records) | 17 | 1771.60 | 1642.54 | 2185.94 | 1687.25 |

### System.evtx (20.07 MB, 42,007 records, 315 chunks)

| Benchmark | runs | avg (ms) | min (ms) | max (ms) | median (ms) |
|-----------|------|----------|----------|----------|-------------|
| parseEvtx (full pipeline) | 17 | 4079.42 | 3867.26 | 4613.39 | 4067.80 |
| parseFileHeader | 2769307 | 0.00 | 0.00 | 0.05 | 0.00 |
| discoverChunkOffsets | 277231 | 0.00 | 0.00 | 0.66 | 0.00 |
| parseChunk (all chunks) | 20 | 41.75 | 39.84 | 46.72 | 41.38 |
| parseEventRecord (all records) | 17 | 3906.89 | 3814.89 | 4426.74 | 3850.43 |

