# Benchmark Scripts

Helper modules sourced by `../bench-all.sh`. Don't run these directly.

| File | Purpose |
|------|---------|
| `lib.sh` | Colors, logging, timing helpers (`get_formatted`, `measure_cmd_once_seconds`, etc.) |
| `builders.sh` | Clone + build functions for external parsers (Rust, libevtx, Go, Python, WASM) |
| `preflight.sh` | `run_preflight()` — tool checks, builds, sets `HAS_*` flags |
| `run-benchmarks.sh` | `run_xml_benchmark` / `run_json_benchmark` — hyperfine invocation + single-run fallbacks |
| `results.sh` | Markdown output: table header, metadata, results table, summary |

## Adding a new parser

1. Add a build function in `builders.sh`
2. Add a `HAS_*` flag in `preflight.sh` and call the builder
3. Add the hyperfine command in `run-benchmarks.sh` (XML, JSON, or both)
4. Add the column in `results.sh` (`build_table_header`) and `write_summary`
