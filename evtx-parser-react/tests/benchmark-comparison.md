# Rust vs JS vs C# Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-14 10:10:13 UTC |
| **Node** | v25.6.0 |
| **dotnet** | 10.0.101 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 3 |
| **Runs** | 10 |

## Results

| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | C# 1T (ms) | C# 8T (ms) | JS / Rust 1T | C# 1T / Rust 1T | C# 8T / Rust 8T |
|---|------|------|-------------|-------------|-------------|------------|------------|-------------|----------------|----------------|
| 1 | Application.evtx | 20M | 61.5 | 28.8 | 422.3 | 17.5 | 14.7 | 6.9x | 0.3x | 0.5x |
| 2 | Cadwell.evtx | 1.1M | 5.6 | 5.5 | 147.9 | 3.7 | 3.0 | 26.4x | 0.7x | 0.5x |
| 3 | security_big_sample.evtx | 30M | 159.3 | 55.7 | 1034.1 | 52.2 | 44.4 | 6.5x | 0.3x | 0.8x |
| 4 | System.evtx | 20M | 96.0 | 36.3 | 602.3 | 34.2 | 27.8 | 6.3x | 0.4x | 0.8x |
| 5 | 2-system-Microsoft-Windows-LiveId%4Operational.evtx | 1.0M | 7.1 | 4.3 | 124.7 | 3.0 | 2.5 | 17.6x | 0.4x | 0.6x |
| 6 | 2-system-Security-dirty.evtx | 12M | 47.6 | 20.6 | 249.8 | 14.4 | 11.8 | 5.2x | 0.3x | 0.6x |
| 7 | 2-vss_0-Microsoft-Windows-RemoteDesktopServices-RdpCoreTS%4Operational.evtx | 1.0M | 6.8 | 4.6 | 145.8 | 4.3 | 3.6 | 21.4x | 0.6x | 0.8x |
| 8 | 2-vss_0-Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx | 1.0M | 6.4 | 4.5 | 140.5 | 4.4 | 4.2 | 22.0x | 0.7x | 0.9x |
| 9 | 2-vss_7-System.evtx | 1.1M | 5.2 | 5.6 | 145.7 | 4.8 | 6.5 | 28.0x | 0.9x | 1.2x |
| 10 | Application_no_crc32.evtx | 68K | 2.2 | 2.1 | 117.9 | 4.0 | 3.8 | 53.6x | 1.8x | 1.8x |
| 11 | Application.evtx | 4.0M | 18.3 | 12.2 | 188.5 | 9.2 | 11.6 | 10.3x | 0.5x | 1.0x |
| 12 | Archive-ForwardedEvents-test.evtx | 4.1M | 8.3 | 5.8 | 121.4 | 3.9 | 3.3 | 14.6x | 0.5x | 0.6x |
| 13 | E_ShadowCopy6_windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 4.8 | 3.8 | 127.4 | 3.4 | 3.6 | 26.5x | 0.7x | 0.9x |
| 14 | E_Windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 4.4 | 4.4 | 128.2 | 3.6 | 9.6 | 29.1x | 0.8x | 2.2x |
| 15 | E_Windows_system32_winevt_logs_Microsoft-Windows-Shell-Core%4Operational.evtx | 1.0M | 5.0 | 5.8 | 136.0 | 3.8 | 3.4 | 27.2x | 0.8x | 0.6x |
| 16 | issue_201.evtx | 68K | 2.0 | 2.2 | 117.3 | 7.6 | 2.8 | 58.6x | 3.8x | 1.3x |
| 17 | Microsoft-Windows-HelloForBusiness%4Operational.evtx | 68K | 1.5 | 1.5 | 120.8 | 1.3 | 1.3 | 80.5x | 0.9x | 0.9x |
| 18 | Microsoft-Windows-LanguagePackSetup%4Operational.evtx | 68K | 2.5 | 2.2 | 118.0 | 2.7 | 2.2 | 47.2x | 1.1x | 1.0x |
| 19 | MSExchange_Management_wec.evtx | 68K | 2.2 | 2.0 | 121.0 | 2.6 | 2.6 | 55.0x | 1.2x | 1.3x |
| 20 | new-user-security.evtx | 68K | 1.9 | 2.4 | 117.3 | 3.3 | 3.0 | 61.7x | 1.7x | 1.3x |
| 21 | post-Security.evtx | 1.1M | 3.1 | 7.2 | 121.7 | 3.8 | 3.1 | 39.3x | 1.2x | 0.4x |
| 22 | sample_with_a_bad_chunk_magic.evtx | 1.0M | 2.8 | 3.8 | 121.0 | 3.0 | 2.9 | 43.2x | 1.1x | 0.8x |
| 23 | sample-with-irregular-bool-values.evtx | 2.1M | 9.5 | 8.2 | 153.4 | 4.5 | 3.6 | 16.1x | 0.5x | 0.4x |
| 24 | sample-with-zero-data-size-event.evtx | 1.1M | 3.8 | 6.0 | 128.1 | 4.6 | 4.7 | 33.7x | 1.2x | 0.8x |
| 25 | security_bad_string_cache.evtx | 2.1M | 9.5 | 8.5 | 158.7 | 4.5 | 3.7 | 16.7x | 0.5x | 0.4x |
| 26 | security_big_sample.evtx | 30M | 159.2 | 56.5 | 998.0 | 51.4 | 38.6 | 6.3x | 0.3x | 0.7x |
| 27 | Security_short_selected.evtx | 68K | 2.5 | 2.5 | 124.6 | 3.3 | 3.1 | 49.8x | 1.3x | 1.2x |
| 28 | Security_with_size_t.evtx | 1.1M | 5.4 | 6.1 | 173.6 | 5.3 | 5.6 | 32.1x | 1.0x | 0.9x |
| 29 | security.evtx | 2.1M | 11.6 | 9.0 | 215.4 | 6.2 | 6.4 | 18.6x | 0.5x | 0.7x |
| 30 | sysmon.evtx | 1.1M | 5.4 | 4.4 | 138.0 | 3.1 | 2.9 | 25.6x | 0.6x | 0.7x |
| 31 | system.evtx | 1.1M | 6.9 | 5.2 | 145.0 | 5.6 | 7.5 | 21.0x | 0.8x | 1.4x |

## Summary

- **Files tested:** 31
- **Passed:** 31
- **Failed (JS):** 0
- **C# included:** yes
