#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUST_BIN="$PROJECT_DIR/../evtx-master/target/release/evtx_dump"
JS_CLI="$SCRIPT_DIR/bench-cli.ts"
CSHARP_PROJECT="$PROJECT_DIR/../EvtxParserWasm.Bench/EvtxParserWasm.Bench.csproj"
CSHARP_BIN="$PROJECT_DIR/../EvtxParserWasm.Bench/bin/publish/EvtxParserWasm.Bench"

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

# Build C# bench binary if project exists
HAS_CSHARP=false
if [[ -f "$CSHARP_PROJECT" ]]; then
  echo "Building C# bench binary..."
  if dotnet publish "$CSHARP_PROJECT" -c Release -o "$(dirname "$CSHARP_BIN")" --nologo -v quiet 2>/dev/null; then
    HAS_CSHARP=true
    echo "  C# binary ready at $CSHARP_BIN"
  else
    echo "  ⚠ C# build failed — skipping C# benchmarks"
  fi
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
  echo "# Rust vs JS vs C# Parser Benchmark Comparison"
  echo ""
  echo "| Field | Value |"
  echo "|-------|-------|"
  echo "| **Date** | $(date -u '+%Y-%m-%d %H:%M:%S UTC') |"
  echo "| **Node** | $(node --version) |"
  echo "| **dotnet** | $(dotnet --version 2>/dev/null || echo 'N/A') |"
  echo "| **Platform** | $(uname -s) $(uname -m) |"
  echo "| **Rust binary** | \`evtx_dump --release\` |"
  echo "| **Warmup** | $WARMUP |"
  echo "| **Runs** | $RUNS |"
  echo ""
  echo "## Results"
  echo ""
  if $HAS_CSHARP; then
    echo "| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | C# 1T (ms) | C# 8T (ms) | JS / Rust 1T | C# 1T / Rust 1T | C# 8T / Rust 8T |"
    echo "|---|------|------|-------------|-------------|-------------|------------|------------|-------------|----------------|----------------|"
  else
    echo "| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms) | JS / Rust 1T | JS / Rust 8T |"
    echo "|---|------|------|-------------|-------------|-------------|-------------|-------------|"
  fi
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
    rust1t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 1 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    rust8t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 8 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    if $HAS_CSHARP; then
      echo "| $i | $name | $size | $rust1t | $rust8t | FAIL | – | – | – | – | – |" >> "$RESULTS"
    else
      echo "| $i | $name | $size | $rust1t | $rust8t | FAIL | – | – |" >> "$RESULTS"
    fi
    fail=$((fail + 1))
    continue
  fi

  # Build hyperfine command list
  tmp=$(mktemp)
  if $HAS_CSHARP; then
    hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
      --export-json "$tmp" \
      --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null" \
      --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null" \
      --command-name "js-node" "node --import tsx '$JS_CLI' '$file'" \
      --command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1" \
      --command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8" \
      2>&1 | sed 's/^/  /'

    # Extract mean times from JSON (in seconds → ms)
    rust1t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[0].mean*1000).toFixed(1))")
    rust8t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[1].mean*1000).toFixed(1))")
    js_ms=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[2].mean*1000).toFixed(1))")
    cs1t_ms=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[3].mean*1000).toFixed(1))")
    cs8t_ms=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[4].mean*1000).toFixed(1))")

    ratio_js=$(node -e "console.log(($js_ms / $rust1t).toFixed(1))")
    ratio_cs1t=$(node -e "console.log(($cs1t_ms / $rust1t).toFixed(1))")
    ratio_cs8t=$(node -e "console.log(($cs8t_ms / $rust8t).toFixed(1))")

    echo "| $i | $name | $size | $rust1t | $rust8t | $js_ms | $cs1t_ms | $cs8t_ms | ${ratio_js}x | ${ratio_cs1t}x | ${ratio_cs8t}x |" >> "$RESULTS"
  else
    hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
      --export-json "$tmp" \
      --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null" \
      --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null" \
      --command-name "js-node" "node --import tsx '$JS_CLI' '$file'" \
      2>&1 | sed 's/^/  /'

    rust1t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[0].mean*1000).toFixed(1))")
    rust8t=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[1].mean*1000).toFixed(1))")
    js_ms=$(node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[2].mean*1000).toFixed(1))")

    ratio1t=$(node -e "console.log(($js_ms / $rust1t).toFixed(1))")
    ratio8t=$(node -e "console.log(($js_ms / $rust8t).toFixed(1))")

    echo "| $i | $name | $size | $rust1t | $rust8t | $js_ms | ${ratio1t}x | ${ratio8t}x |" >> "$RESULTS"
  fi

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
  if $HAS_CSHARP; then
    echo "- **C# included:** yes"
  fi
} >> "$RESULTS"

echo "========================================="
echo "Done! $pass passed, $fail failed"
echo "Results written to: $RESULTS"
echo "========================================="
