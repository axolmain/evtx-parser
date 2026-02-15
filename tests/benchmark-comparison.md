# Rust vs JS vs C# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 02:50:14 UTC |
| **Node** | v25.6.0 |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 3 |
| **Runs** | 10 |

## Results

| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | C# 1T (ms) | C# 8T (ms) | Rust WASM (ms) | C# WASM (ms) | JS / Rust 1T | C# 1T / Rust 1T | C# 8T / Rust 8T | Rust WASM / Rust 1T | C# WASM / Rust 1T |
|---|------|------|-------------|-------------|-------------|------------|------------|---------------|--------------|-------------|----------------|----------------|--------------------|------------------|
| 1 | Application.evtx | 20M | 62.3 | 28.5 | 429.8 | 26.3 | 20.3 | 556.7 | 388.9 | 6.9x | 0.4x | 0.7x | 8.9x | 6.2x |
| 2 | Cadwell.evtx | 1.1M | 4.6 | 4.2 | 135.8 | 8.8 | 9.4 | 91.1 | 157.9 | 29.5x | 1.9x | 2.2x | 19.8x | 34.3x |
| 3 | security_big_sample.evtx | 30M | 180.8 | 95.6 | 1039.5 | 65.7 | 45.9 | 1778.7 | 906.5 | 5.7x | 0.4x | 0.5x | 9.8x | 5.0x |
