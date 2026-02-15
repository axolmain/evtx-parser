# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 06:20:10 UTC |
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

| File | C# (1 thread) | C# (8 threads) | C# WASM | evtx (Rust - 1 thread) | evtx (Rust - 8 threads) | Rust WASM | JS Node | velocidex/evtx (Go) | golang-evtx (Go) | pyevtx-rs | python-evtx (CPython) | python-evtx (PyPy) |
|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|
| 31M security_big_sample.evtx (XML) | 121.3 ms ± 6.4 ms | 69.7 ms ± 0.9 ms | No support | 302.9 ms ± 2.0 ms | 99.0 ms ± 1.0 ms | No support | 2.005 s ± 0.073 s | No support | No support | No support | 2m47.654s (ran once) | 51.105s (ran once) |
| 31M security_big_sample.evtx (JSON) | 335.2 ms ± 4.8 ms | 161.1 ms ± 4.9 ms | 1.499 s ± 0.050 s | 272.4 ms ± 1.1 ms | 94.3 ms ± 3.2 ms | 3.347 s ± 0.291 s | 2.565 s ± 0.037 s | 4.231 s ± 0.037 s | 1.985 s ± 0.198 s | 0.515s (ran once) | No support | No support |

**Note**: Numbers shown are `real-time` measurements (wall-clock time for invocation to complete). Single-run entries are marked with *(ran once)* — these parsers are too slow for repeated benchmarking via hyperfine.

## Relative Performance (vs fastest)

| File | C# (1 thread) | C# (8 threads) | C# WASM | evtx (Rust - 1 thread) | evtx (Rust - 8 threads) | Rust WASM | JS Node | velocidex/evtx (Go) | golang-evtx (Go) | pyevtx-rs | python-evtx (CPython) | python-evtx (PyPy) |
|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|----------------------|
| 31M security_big_sample.evtx (XML) | 1.7x | **1.0x** | — | 4.3x | 1.4x | — | 28.8x | — | — | — | 2407.1x | 733.7x |
| 31M security_big_sample.evtx (JSON) | 3.6x | 1.7x | 15.9x | 2.9x | **1.0x** | 35.5x | 27.2x | 44.9x | 21.0x | 5.5x | — | — |

**1.0x** = fastest for that row. Higher = slower.

## Summary

- **Files tested:** 1
- **Passed:** 1
- **Failed (JS):** 0

### Internal parsers
- C# native: yes
- Rust WASM: yes
- C# WASM (AOT): yes

### External parsers
- libevtx (C): skipped
- Velocidex (Go): yes
- 0xrawsec (Go): yes
- python-evtx CPython: yes
- python-evtx PyPy: yes
- pyevtx-rs: yes
