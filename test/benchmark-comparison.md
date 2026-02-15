# Rust vs JS vs C# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 03:56:17 UTC |
| **Node** | v25.6.0 |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 3 |
| **Runs** | 10 |

## Results

| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | C# 1T (ms) | C# 8T (ms) | Rust WASM (ms) | C# WASM (ms) | JS / Rust 1T | C# 1T / Rust 1T | C# 8T / Rust 8T | Rust WASM / Rust 1T | C# WASM / Rust 1T |
|---|------|------|-------------|-------------|-------------|------------|------------|---------------|--------------|-------------|----------------|----------------|--------------------|------------------|
| 1 | 2-system-Microsoft-Windows-LiveId%4Operational.evtx | 1.0M | 12.5 | 5.9 | 112.5 | 7.0 | 8.1 | 151.7 | 277.9 | 9.0x | 0.6x | 1.4x | 12.1x | 22.2x |
| 2 | 2-system-Security-dirty.evtx | 12M | 94.8 | 36.8 | 471.3 | 37.7 | 24.4 | 786.7 | 667.6 | 5.0x | 0.4x | 0.7x | 8.3x | 7.0x |
