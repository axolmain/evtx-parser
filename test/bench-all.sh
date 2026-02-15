#!/usr/bin/env bash
set -euo pipefail

# ── Parse flags ─────────────────────────────────────────────────────
NATIVE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --native-only) NATIVE_ONLY=true ;;
  esac
done

# ── Path variables (set BEFORE sourcing helpers) ────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REACT_DIR="$ROOT_DIR/evtx-parser-react"
JS_CLI_SRC="$SCRIPT_DIR/bench-cli.ts"
JS_CLI="$SCRIPT_DIR/bench-cli.mjs"
CSHARP_PROJECT="$ROOT_DIR/EvtxParserWasm.Bench/EvtxParserWasm.Bench.csproj"
CSHARP_BIN="$ROOT_DIR/EvtxParserWasm.Bench/bin/publish/EvtxParserWasm.Bench"
CS_WASM_CLI="$SCRIPT_DIR/bench-wasm-cli.mjs"
CS_WASM_FRAMEWORK="$ROOT_DIR/evtx-parser-react/public/_framework"
RUST_WASM_CLI="$SCRIPT_DIR/bench-rust-wasm-cli.mjs"

# External parsers directory (sibling to repo, won't be git-committed)
EXTERNAL_DIR="${EXTERNAL_DIR:-$ROOT_DIR/../evtx-external}"

# Rust evtx parser (cloned from GitHub into external dir)
RUST_DIR="$EXTERNAL_DIR/evtx-rust"
RUST_BIN="$RUST_DIR/target/release/evtx_dump"
RUST_WASM_PKG="$RUST_DIR/evtx-wasm/pkg"

# Hyperfine settings (env-overridable)
WARMUP="${HYPERFINE_WARMUP:-5}"
RUNS="${HYPERFINE_RUNS:-10}"

# Test data
TEST_DATA="$SCRIPT_DIR/data/benchmark"

# Output file
RESULTS="$SCRIPT_DIR/benchmark-comparison.md"

# ── Source helpers ──────────────────────────────────────────────────
source "$SCRIPT_DIR/bench/lib.sh"
source "$SCRIPT_DIR/bench/builders.sh"
source "$SCRIPT_DIR/bench/preflight.sh"
source "$SCRIPT_DIR/bench/run-benchmarks.sh"
source "$SCRIPT_DIR/bench/results.sh"

# ── Preflight (sets HAS_* variables) ───────────────────────────────
run_preflight

# ── Collect all .evtx files ─────────────────────────────────────────
declare -a FILES=()

if [[ -d "$TEST_DATA" ]]; then
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$TEST_DATA" -name '*.evtx' -print0 | sort -z)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No .evtx files found in $TEST_DATA" >&2
  exit 1
fi

echo "Found ${#FILES[@]} .evtx files"
echo ""

# ── Build table header + write markdown header ─────────────────────
build_table_header
write_markdown_header

# ── Storage for rows ────────────────────────────────────────────────
declare -a ROWS=()

# ── Run benchmarks ──────────────────────────────────────────────────
i=0
pass=0
fail=0

for file in "${FILES[@]}"; do
  i=$((i + 1))
  name="$(basename "$file")"
  size="$(du -h "$file" | cut -f1 | xargs)"

  echo "[$i/${#FILES[@]}] $name ($size)"

  # Run JS parser first to check it doesn't error out (skip in native-only mode)
  if $HAS_JS; then
    if ! node "$JS_CLI" "$file" -o json &>/dev/null; then
      log_warn "JS parser failed — skipping"
      fail=$((fail + 1))
      continue
    fi
  fi

  file_label="$size $name"

  # XML benchmark — progress goes to stderr, table row to stdout
  ROWS+=("$(run_xml_benchmark "$file" "$file_label")")

  # JSON benchmark — progress goes to stderr, table row to stdout
  ROWS+=("$(run_json_benchmark "$file" "$file_label")")

  pass=$((pass + 1))
  echo ""
done

# ── Write results + summary ─────────────────────────────────────────
write_results_table "${ROWS[@]}"
write_summary "${#FILES[@]}" "$pass" "$fail"

echo "========================================="
echo "Done! $pass passed, $fail failed"
echo "Results written to: $RESULTS"
echo "========================================="
