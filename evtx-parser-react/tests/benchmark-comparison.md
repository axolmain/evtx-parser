# Rust vs JS Parser Benchmark Comparison

| Field | Value |
|-------|-------|
| **Date** | 2026-02-13 08:16:54 UTC |
| **Node** | v25.6.0 |
| **Platform** | Darwin arm64 |
| **Rust binary** | `evtx_dump --release` |
| **Warmup** | 3 |
| **Runs** | 10 |

## Results

| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | JS / Rust 1T | JS / Rust 8T |
|---|------|------|-------------|-------------|-------------|-------------|-------------|
| 1 | Application.evtx | 21M | 120.5 | 39.9 | 593.6 | 4.9x | 14.9x |
| 2 | Cadwell.evtx | 2.1M | 9.6 | 9.0 | 249.8 | 26.0x | 27.8x |
| 3 | ForSeb.evtx | 14M | 89.0 | 32.6 | 520.2 | 5.8x | 16.0x |
| 4 | system-github.evtx | 2.1M | 11.3 | 11.4 | 258.6 | 22.9x | 22.7x |
| 5 | System.evtx | 21M | 187.6 | 65.5 | 878.9 | 4.7x | 13.4x |
| 6 | 2-system-Microsoft-Windows-LiveId%4Operational.evtx | 1.0M | 13.8 | 7.2 | 236.1 | 17.1x | 32.8x |
| 7 | 2-system-Security-dirty.evtx | 12M | 93.9 | 35.1 | 435.1 | 4.6x | 12.4x |
| 8 | 2-vss_0-Microsoft-Windows-RemoteDesktopServices-RdpCoreTS%4Operational.evtx | 1.0M | 12.5 | 7.0 | 260.3 | 20.8x | 37.2x |
| 9 | 2-vss_0-Microsoft-Windows-TerminalServices-RemoteConnectionManager%4Operational.evtx | 1.0M | 11.3 | 6.7 | 264.4 | 23.4x | 39.5x |
| 10 | 2-vss_7-System.evtx | 1.1M | 10.1 | 9.4 | 258.3 | 25.6x | 27.5x |
| 11 | Application_no_crc32.evtx | 68K | 3.9 | 4.4 | 233.4 | 59.8x | 53.0x |
| 12 | Application.evtx | 4.0M | 32.6 | 18.5 | 338.4 | 10.4x | 18.3x |
| 13 | Archive-ForwardedEvents-test.evtx | 4.1M | 14.1 | 8.3 | 234.9 | 16.7x | 28.3x |
| 14 | E_ShadowCopy6_windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 9.4 | 6.5 | 236.3 | 25.1x | 36.4x |
| 15 | E_Windows_system32_winevt_logs_Microsoft-Windows-CAPI2%4Operational.evtx | 1.0M | 8.4 | 7.5 | 241.0 | 28.7x | 32.1x |
| 16 | E_Windows_system32_winevt_logs_Microsoft-Windows-Shell-Core%4Operational.evtx | 1.0M | 9.4 | 10.7 | 251.7 | 26.8x | 23.5x |
| 17 | issue_201.evtx | 68K | 3.8 | 3.9 | 234.2 | 61.6x | 60.1x |
| 18 | Microsoft-Windows-HelloForBusiness%4Operational.evtx | 68K | 3.6 | 4.1 | 225.1 | 62.5x | 54.9x |
| 19 | Microsoft-Windows-LanguagePackSetup%4Operational.evtx | 68K | 3.7 | 3.7 | 221.4 | 59.8x | 59.8x |
| 20 | MSExchange_Management_wec.evtx | 68K | 4.5 | 3.9 | 225.1 | 50.0x | 57.7x |
| 21 | new-user-security.evtx | 68K | 4.0 | 3.5 | 219.3 | 54.8x | 62.7x |
| 22 | post-Security.evtx | 1.1M | 5.8 | 12.8 | 230.1 | 39.7x | 18.0x |
| 23 | sample_with_a_bad_chunk_magic.evtx | 1.0M | 5.9 | 10.6 | 233.7 | 39.6x | 22.0x |
| 24 | sample-with-irregular-bool-values.evtx | 2.1M | 16.5 | 14.6 | 273.5 | 16.6x | 18.7x |
| 25 | sample-with-zero-data-size-event.evtx | 1.1M | 6.1 | 10.7 | 234.0 | 38.4x | 21.9x |
| 26 | security_bad_string_cache.evtx | 2.1M | 17.8 | 12.3 | 277.2 | 15.6x | 22.5x |
| 27 | security_big_sample.evtx | 30M | 313.0 | 106.8 | 1239.8 | 4.0x | 11.6x |
| 28 | Security_short_selected.evtx | 68K | 3.9 | 3.6 | 225.4 | 57.8x | 62.6x |
| 29 | Security_with_size_t.evtx | 1.1M | 8.0 | 9.5 | 248.9 | 31.1x | 26.2x |
| 30 | security.evtx | 2.1M | 17.4 | 12.5 | 278.7 | 16.0x | 22.3x |
| 31 | sysmon.evtx | 1.1M | 8.0 | 5.7 | 238.5 | 29.8x | 41.8x |
| 32 | system.evtx | 1.1M | 12.8 | 7.9 | 270.8 | 21.2x | 34.3x |

## Summary

- **Files tested:** 32
- **Passed:** 32
- **Failed (JS):** 0
