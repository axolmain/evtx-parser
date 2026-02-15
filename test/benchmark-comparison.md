# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 08:19:27 UTC |
| **Node** | v25.6.0 |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 5 |
| **Runs** | 10 |
| **Velocidex (Go)** | dumpevtx |
| **0xrawsec (Go)** | evtxdump |
| **python-evtx** | CPython venv |
| **python-evtx** | PyPy venv |
| **pyevtx-rs** | via `uv run --with evtx` |

## Benchmark Results

| File | C# (1 thread) | C# (8 threads) | C# WASM | evtx (Rust - 1 thread) | evtx (Rust - 8 threads) | JS Node | velocidex/evtx (Go) | golang-evtx (Go) | pyevtx-rs | python-evtx (CPython) | python-evtx (PyPy) |
|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|
| 31M security_big_sample.evtx (XML) | 119.4 ms ± 3.8 ms | 70.7 ms ± 0.6 ms | not ran bc it's for web | 301.2 ms ± 1.4 ms | 102.8 ms ± 7.3 ms | 1.930 s ± 0.026 s | No support | No support | 0.485s (ran once) | 2m43.937s (ran once) | 54.110s (ran once) |
| 31M security_big_sample.evtx (JSON) | 324.9 ms ± 7.8 ms | 158.9 ms ± 7.1 ms | 1.753 s ± 0.383 s | 623.3 ms ± 65.3 ms | 729.9 ms ± 229.1 ms | 3.296 s ± 0.717 s | 5.820 s ± 1.765 s | 1.907 s ± 0.065 s | 0.569s (ran once) | No support | No support |

**Note**: Numbers shown are `real-time` measurements (wall-clock time for invocation to complete). Single-run entries are marked with *(ran once)* — these parsers are too slow for repeated benchmarking via hyperfine.

## Summary

- **Files tested:** 1
- **Passed:** 1
- **Failed (JS):** 0

### Internal parsers
- C# native: yes
- Rust native: yes
- JS Node: yes
- C# WASM (AOT): yes

### External parsers
- libevtx (C): skipped
- Velocidex (Go): yes
- 0xrawsec (Go): yes
- python-evtx CPython: yes
- python-evtx PyPy: yes
- pyevtx-rs: yes
