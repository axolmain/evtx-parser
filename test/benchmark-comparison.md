# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 07:14:57 UTC |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Mode** | native-only (C# + Rust) |
| **Warmup** | 5 |
| **Runs** | 10 |

## Benchmark Results

| File | C# (1 thread) | C# (8 threads) | evtx (Rust - 1 thread) | evtx (Rust - 8 threads) |
|----------------------|----------------------|----------------------|----------------------|----------------------|
| 31M security_big_sample.evtx (XML) | 279.7 ms ± 26.3 ms | 316.4 ms ± 170.6 ms | 572.9 ms ± 25.8 ms | 546.6 ms ± 78.5 ms |
| 31M security_big_sample.evtx (JSON) | 469.0 ms ± 189.0 ms | 180.9 ms ± 37.9 ms | 576.6 ms ± 53.5 ms | 813.1 ms ± 216.6 ms |

**Note**: Numbers shown are `real-time` measurements (wall-clock time for invocation to complete). Single-run entries are marked with *(ran once)* — these parsers are too slow for repeated benchmarking via hyperfine.

## Summary

- **Files tested:** 1
- **Passed:** 1
- **Mode:** native-only (C# + Rust)

### Internal parsers
- C# native: yes
- Rust native: yes
