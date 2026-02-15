# Rust vs JS vs C# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-15 02:19:08 UTC |
| **Node** | v25.6.0 |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 3 |
| **Runs** | 10 |

## Results

| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | C# 1T (ms) | C# 8T (ms) | JS / Rust 1T | C# 1T / Rust 1T | C# 8T / Rust 8T |
|---|------|------|-------------|-------------|-------------|------------|------------|-------------|----------------|----------------|
| 1 | Application.evtx | 20M | 61.6 | 28.3 | 435.1 | 17.2 | 13.7 | 7.1x | 0.3x | 0.5x |
| 2 | Cadwell.evtx | 1.1M | 5.1 | 5.3 | 135.7 | 3.7 | 3.2 | 26.6x | 0.7x | 0.6x |
| 3 | security_big_sample.evtx | 30M | 159.8 | 56.3 | 1038.2 | 76.2 | 38.6 | 6.5x | 0.5x | 0.7x |
| 4 | System.evtx | 20M | 95.5 | 36.5 | 580.7 | 33.1 | 32.8 | 6.1x | 0.3x | 0.9x |
| 5 | 2-system-Microsoft-Windows-LiveId%4Operational.evtx | 1.0M | 7.3 | 4.4 | 130.4 | 4.0 | 3.9 | 17.9x | 0.5x | 0.9x |
| 6 | 2-system-Security-dirty.evtx | 12M | 48.8 | 21.1 | 251.5 | 14.7 | 12.4 | 5.2x | 0.3x | 0.6x |
| 7 | 2-vss_0-Microsoft-Windows-RemoteDesktopServices-RdpCoreTS%4Operational.evtx | 1.0M | 6.7 | 4.3 | 143.4 | 4.3 | 3.3 | 21.4x | 0.6x | 0.8x |
| 8 | 2-vss_0-Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx | 1.0M | 6.4 | 4.3 | 143.7 | 4.5 | 3.5 | 22.5x | 0.7x | 0.8x |
| 9 | 2-vss_7-System.evtx | 1.1M | 5.4 | 5.1 | 148.6 | 4.7 | 7.4 | 27.5x | 0.9x | 1.5x |
| 10 | Application_no_crc32.evtx | 68K | 2.2 | 2.7 | 118.3 | 4.0 | 4.3 | 53.8x | 1.8x | 1.6x |
| 11 | Application.evtx | 4.0M | 16.6 | 25.0 | 194.4 | 9.4 | 12.4 | 11.7x | 0.6x | 0.5x |
| 12 | Archive-ForwardedEvents-test.evtx | 4.1M | 7.5 | 5.4 | 121.7 | 8.5 | 5.5 | 16.2x | 1.1x | 1.0x |
| 13 | E_ShadowCopy6_windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 5.1 | 4.1 | 125.9 | 3.4 | 2.8 | 24.7x | 0.7x | 0.7x |
| 14 | E_Windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 4.3 | 4.6 | 126.1 | 3.1 | 2.8 | 29.3x | 0.7x | 0.6x |
| 15 | E_Windows_system32_winevt_logs_Microsoft-Windows-Shell-Core%4Operational.evtx | 1.0M | 4.7 | 5.7 | 134.5 | 3.7 | 3.0 | 28.6x | 0.8x | 0.5x |
| 16 | issue_201.evtx | 68K | 2.1 | 2.3 | 120.7 | 3.0 | 2.5 | 57.5x | 1.4x | 1.1x |
| 17 | Microsoft-Windows-HelloForBusiness%4Operational.evtx | 68K | 1.8 | 1.2 | 120.3 | 2.2 | 1.7 | 66.8x | 1.2x | 1.4x |
| 18 | Microsoft-Windows-LanguagePackSetup%4Operational.evtx | 68K | 2.0 | 1.9 | 118.3 | 2.9 | 2.4 | 59.1x | 1.4x | 1.3x |
| 19 | MSExchange_Management_wec.evtx | 68K | 2.0 | 1.9 | 117.0 | 2.9 | 2.5 | 58.5x | 1.4x | 1.3x |
| 20 | new-user-security.evtx | 68K | 2.1 | 1.9 | 116.5 | 2.8 | 2.4 | 55.5x | 1.3x | 1.3x |
| 21 | post-Security.evtx | 1.1M | 2.8 | 6.9 | 123.5 | 3.5 | 2.7 | 44.1x | 1.3x | 0.4x |
| 22 | sample_with_a_bad_chunk_magic.evtx | 1.0M | 3.1 | 3.9 | 123.9 | 3.3 | 3.0 | 40.0x | 1.1x | 0.8x |
| 23 | sample-with-irregular-bool-values.evtx | 2.1M | 9.0 | 10.5 | 158.6 | 5.1 | 4.6 | 17.6x | 0.6x | 0.4x |
| 24 | sample-with-zero-data-size-event.evtx | 1.1M | 3.4 | 6.1 | 141.4 | 4.6 | 4.7 | 41.6x | 1.4x | 0.8x |
| 25 | security_bad_string_cache.evtx | 2.1M | 10.5 | 8.4 | 173.6 | 4.3 | 3.7 | 16.5x | 0.4x | 0.4x |
| 26 | security_big_sample.evtx | 30M | 160.0 | 59.0 | 1069.2 | 52.2 | 38.9 | 6.7x | 0.3x | 0.7x |
| 27 | Security_short_selected.evtx | 68K | 2.2 | 2.2 | 120.9 | 3.0 | 2.5 | 55.0x | 1.4x | 1.1x |
| 28 | Security_with_size_t.evtx | 1.1M | 4.4 | 5.6 | 133.9 | 3.2 | 2.7 | 30.4x | 0.7x | 0.5x |
| 29 | security.evtx | 2.1M | 9.8 | 7.8 | 159.9 | 4.5 | 3.8 | 16.3x | 0.5x | 0.5x |
| 30 | sysmon.evtx | 1.1M | 4.0 | 3.9 | 126.3 | 3.1 | 3.3 | 31.6x | 0.8x | 0.8x |
| 31 | system.evtx | 1.1M | 6.9 | 5.0 | 143.4 | 5.2 | 7.2 | 20.8x | 0.8x | 1.4x |

## C# WASM (single-threaded, Node.js)

| # | File | Size | WASM (ms) | JS (ms) | WASM / JS |
|---|------|------|-----------|---------|-----------|
| 1 | Application.evtx | 20M | 359.0 | 421.3 | 0.9x |
| 2 | Cadwell.evtx | 1.1M | 157.9 | 138.7 | 1.1x |
| 3 | security_big_sample.evtx | 30M | 782.5 | 1040.6 | 0.8x |
| 4 | System.evtx | 20M | 653.7 | 571.7 | 1.1x |
| 5 | 2-system-Microsoft-Windows-LiveId%4Operational.evtx | 1.0M | 147.4 | 126.3 | 1.2x |
| 6 | 2-system-Security-dirty.evtx | 12M | 342.7 | 263.6 | 1.3x |
| 7 | 2-vss_0-Microsoft-Windows-RemoteDesktopServices-RdpCoreTS%4Operational.evtx | 1.0M | 184.5 | 140.9 | 1.3x |
| 8 | 2-vss_0-Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx | 1.0M | 194.5 | 141.1 | 1.4x |
| 9 | 2-vss_7-System.evtx | 1.1M | 169.9 | 135.1 | 1.3x |
| 10 | Application_no_crc32.evtx | 68K | 147.3 | 118.0 | 1.2x |
