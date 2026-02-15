#!/usr/bin/env bash
# Markdown results output: table header, header metadata, results table, summary.
# Expects all path variables, HAS_* flags, NATIVE_ONLY, WARMUP, RUNS, RESULTS set by parent scope.

# Build the dynamic table header and separator based on active parsers.
# Sets: tbl_header, tbl_sep
build_table_header() {
  tbl_header="| File |"
  tbl_sep="|----------------------|"
  if $HAS_CSHARP; then
    tbl_header="$tbl_header C# (1 thread) | C# (8 threads) |"
    tbl_sep="$tbl_sep----------------------|----------------------|"
  fi
  if $HAS_CS_WASM; then
    tbl_header="$tbl_header C# WASM |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  tbl_header="$tbl_header evtx (Rust - 1 thread) | evtx (Rust - 8 threads) |"
  tbl_sep="$tbl_sep----------------------|----------------------|"
  if $HAS_RUST_WASM; then
    tbl_header="$tbl_header Rust WASM |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_JS; then
    tbl_header="$tbl_header JS Node |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_LIBEVTX; then
    tbl_header="$tbl_header libevtx (C) |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_VELOCIDEX; then
    tbl_header="$tbl_header velocidex/evtx (Go) |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_0XRAWSEC; then
    tbl_header="$tbl_header golang-evtx (Go) |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_PYEVTX_RS; then
    tbl_header="$tbl_header pyevtx-rs |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_PYTHON_EVTX; then
    tbl_header="$tbl_header python-evtx (CPython) |"
    tbl_sep="$tbl_sep----------------------|"
  fi
  if $HAS_PYTHON_EVTX_PYPY; then
    tbl_header="$tbl_header python-evtx (PyPy) |"
    tbl_sep="$tbl_sep----------------------|"
  fi
}

# Write the metadata header block to $RESULTS (overwrites file).
write_markdown_header() {
  {
    echo "# Parser Benchmark Comparison"
    echo ""
    echo "| Field | Value |"
    echo "|-------|-------|"
    echo "| **Date** | $(date -u '+%Y-%m-%d %H:%M:%S UTC') |"
    $HAS_JS && echo "| **Node** | $(node --version) |"
    echo "| **dotnet** | $(dotnet --version 2>/dev/null || echo 'N/A') |"
    echo "| **Platform** | $(uname -s) $(uname -m) |"
    echo "| **Rust binary** | \`evtx_dump --release\` |"
    $NATIVE_ONLY && echo "| **Mode** | native-only (C# + Rust) |"
    echo "| **Warmup** | $WARMUP |"
    echo "| **Runs** | $RUNS |"
    $HAS_LIBEVTX && echo "| **libevtx (C)** | evtxexport (single-threaded) |"
    $HAS_VELOCIDEX && echo "| **Velocidex (Go)** | dumpevtx |"
    $HAS_0XRAWSEC && echo "| **0xrawsec (Go)** | evtxdump |"
    $HAS_PYTHON_EVTX && echo "| **python-evtx** | CPython venv |"
    $HAS_PYTHON_EVTX_PYPY && echo "| **python-evtx** | PyPy venv |"
    $HAS_PYEVTX_RS && echo "| **pyevtx-rs** | via \`uv run --with evtx\` |"
    echo ""
  } > "$RESULTS"
}

# Append the benchmark results table to $RESULTS.
# Usage: write_results_table "${ROWS[@]}"
write_results_table() {
  {
    echo "## Benchmark Results"
    echo ""
    echo "$tbl_header"
    echo "$tbl_sep"
    for row in "$@"; do
      echo "$row"
    done
    echo ""
    echo "**Note**: Numbers shown are \`real-time\` measurements (wall-clock time for invocation to complete). Single-run entries are marked with *(ran once)* — these parsers are too slow for repeated benchmarking via hyperfine."
    echo ""
  } >> "$RESULTS"
}

# Append the summary section to $RESULTS.
# Usage: write_summary <file_count> <pass_count> <fail_count>
write_summary() {
  local file_count="$1"
  local pass_count="$2"
  local fail_count="$3"

  {
    echo "## Summary"
    echo ""
    echo "- **Files tested:** $file_count"
    echo "- **Passed:** $pass_count"
    $HAS_JS && echo "- **Failed (JS):** $fail_count"
    $NATIVE_ONLY && echo "- **Mode:** native-only (C# + Rust)"
    echo ""
    echo "### Internal parsers"
    $HAS_CSHARP && echo "- C# native: yes"
    echo "- Rust native: yes"
    if ! $NATIVE_ONLY; then
      $HAS_JS && echo "- JS Node: yes"
      $HAS_RUST_WASM && echo "- Rust WASM: yes"
      $HAS_CS_WASM && echo "- C# WASM (AOT): yes"
      echo ""
      echo "### External parsers"
      $HAS_LIBEVTX && echo "- libevtx (C): yes" || echo "- libevtx (C): skipped"
      $HAS_VELOCIDEX && echo "- Velocidex (Go): yes" || echo "- Velocidex (Go): skipped"
      $HAS_0XRAWSEC && echo "- 0xrawsec (Go): yes" || echo "- 0xrawsec (Go): skipped"
      $HAS_PYTHON_EVTX && echo "- python-evtx CPython: yes" || echo "- python-evtx CPython: skipped"
      $HAS_PYTHON_EVTX_PYPY && echo "- python-evtx PyPy: yes" || echo "- python-evtx PyPy: skipped"
      $HAS_PYEVTX_RS && echo "- pyevtx-rs: yes" || echo "- pyevtx-rs: skipped"
    fi
  } >> "$RESULTS"
}
