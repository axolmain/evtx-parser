#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUST_BIN="$PROJECT_DIR/../evtx-master/target/release/evtx_dump"
JS_CLI="$SCRIPT_DIR/bench-cli.ts"

WARMUP=3
RUNS=10

# Directories to scan
MY_DATA="$PROJECT_DIR/tests/data"
RUST_SAMPLES="$PROJECT_DIR/../evtx-master/samples"

# Output file
RESULTS="$PROJECT_DIR/tests/benchmark-comparison.md"

# ── Preflight ────────────────────────────────────────────────────────
if ! command -v hyperfine &>/dev/null; then
  echo "Error: hyperfine not found. Install with: brew install hyperfine" >&2
  exit 1
fi

if [[ ! -x "$RUST_BIN" ]]; then
  echo "Error: Rust binary not found at $RUST_BIN" >&2
  echo "Build it with: cd evtx-master && cargo build --release" >&2
  exit 1
fi

# ── Collect all .evtx files ─────────────────────────────────────────
declare -a FILES=()

if [[ -d "$MY_DATA" ]]; then
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$MY_DATA" -name '*.evtx' -print0 | sort -z)
fi

if [[ -d "$RUST_SAMPLES" ]]; then
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$RUST_SAMPLES" -name '*.evtx' -print0 | sort -z)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No .evtx files found" >&2
  exit 1
fi

echo "Found ${#FILES[@]} .evtx files"
echo ""

# ── Markdown header ─────────────────────────────────────────────────
{
  echo "# Rust vs JS Parser Benchmark Comparison"
  echo ""
  echo "| Field | Value |"
  echo "|-------|-------|"
  echo "| **Date** | $(date -u '+%Y-%m-%d %H:%M:%S UTC') |"
  echo "| **Node** | $(node --version) |"
  echo "| **Platform** | $(uname -s) $(uname -m) |"
  echo "| **Rust binary** | \`evtx_dump --release\` |"
  echo "| **Warmup** | $WARMUP |"
  echo "| **Runs** | $RUNS |"
  echo ""
  echo "## Results"
  echo ""
  echo "| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | JS / Rust 1T | JS / Rust 8T |"
  echo "|---|------|------|-------------|-------------|-------------|-------------|-------------|"
} > "$RESULTS"

# ── Run benchmarks ──────────────────────────────────────────────────
i=0
pass=0
fail=0

for file in "${FILES[@]}"; do
  i=$((i + 1))
  name="$(basename "$file")"
  size="$(du -h "$file" | cut -f1 | xargs)"

  echo "[$i/${#FILES[@]}] $name ($size)"

  # Run JS parser first to check it doesn't error out
  if ! node --import tsx "$JS_CLI" "$file" &>/dev/null; then
    echo "  ⚠ JS parser failed — skipping (Rust-only result)"
    # Still get Rust time
    rust1t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 1 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    rust8t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 8 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    echo "| $i | $name | $size | $rust1t | $rust8t | FAIL | – | – |" >> "$RESULTS"
    fail=$((fail + 1))
    continue
  fi

  # Run hyperfine with JSON export to a temp file
  tmp=$(mktemp)
  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$tmp" \
    --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null" \
    --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null" \
    --command-name "js-node" "node --import tsx '$JS_CLI' '$file'" \
    2>&1 | sed 's/^/  /'

  # Extract mean times from JSON (in seconds → ms)
  rust1t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[0].mean*1000).toFixed(1))")
  rust8t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[1].mean*1000).toFixed(1))")
  js_ms=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[2].mean*1000).toFixed(1))")

  ratio1t=$(node -e "console.log(($js_ms / $rust1t).toFixed(1))")
  ratio8t=$(node -e "console.log(($js_ms / $rust8t).toFixed(1))")

  echo "| $i | $name | $size | $rust1t | $rust8t | $js_ms | ${ratio1t}x | ${ratio8t}x |" >> "$RESULTS"

  rm -f "$tmp"
  pass=$((pass + 1))
  echo ""
done

# ── Summary ─────────────────────────────────────────────────────────
{
  echo ""
  echo "## Summary"
  echo ""
  echo "- **Files tested:** ${#FILES[@]}"
  echo "- **Passed:** $pass"
  echo "- **Failed (JS):** $fail"
} >> "$RESULTS"

echo "========================================="
echo "Done! $pass passed, $fail failed"
echo "Results written to: $RESULTS"
echo "========================================="
