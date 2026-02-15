#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REACT_DIR="$ROOT_DIR/evtx-parser-react"
RUST_BIN="$ROOT_DIR/evtx-master/target/release/evtx_dump"
JS_CLI_SRC="$SCRIPT_DIR/bench-cli.ts"
JS_CLI="$SCRIPT_DIR/bench-cli.mjs"
CSHARP_PROJECT="$ROOT_DIR/EvtxParserWasm.Bench/EvtxParserWasm.Bench.csproj"
CSHARP_BIN="$ROOT_DIR/EvtxParserWasm.Bench/bin/publish/EvtxParserWasm.Bench"
CS_WASM_CLI="$SCRIPT_DIR/bench-wasm-cli.mjs"
CS_WASM_FRAMEWORK="$ROOT_DIR/evtx-parser-react/public/_framework"
RUST_WASM_CLI="$SCRIPT_DIR/bench-rust-wasm-cli.mjs"
RUST_WASM_PKG="$ROOT_DIR/evtx-master/evtx-wasm/pkg"

WARMUP=3
RUNS=10

# Test data
TEST_DATA="$SCRIPT_DIR/data"

# Output file
RESULTS="$SCRIPT_DIR/benchmark-comparison.md"

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

# Bundle JS benchmark (removes tsx transpilation overhead from measurements)
echo "Bundling JS benchmark..."
npx --yes esbuild "$JS_CLI_SRC" --bundle --platform=node --format=esm --outfile="$JS_CLI" --log-level=warning
echo "  JS bundle ready at $JS_CLI"

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

# Check for C# WASM build
HAS_CS_WASM=false
if [[ -d "$CS_WASM_FRAMEWORK" && -f "$CS_WASM_CLI" ]]; then
  HAS_CS_WASM=true
  echo "  C# WASM benchmark ready"
else
  echo "  ⚠ C# WASM not found — run 'npm run build:wasm' in evtx-parser-react/ to enable"
fi

# Check for Rust WASM build
HAS_RUST_WASM=false
if [[ -f "$RUST_WASM_PKG/evtx_wasm.js" && -f "$RUST_WASM_CLI" ]]; then
  HAS_RUST_WASM=true
  echo "  Rust WASM benchmark ready"
else
  echo "  ⚠ Rust WASM not found — run 'cd evtx-master/evtx-wasm && wasm-pack build --target nodejs --release' to enable"
fi

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

# ── Helper functions ─────────────────────────────────────────────────
get_ms() { node -e "const d=JSON.parse(require('fs').readFileSync('$1','utf8')); console.log((d.results[$2].mean*1000).toFixed(1))"; }
ratio() { node -e "console.log(($1 / $2).toFixed(1))"; }

# ── Build XML table header ──────────────────────────────────────────
xml_header="| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms)"
xml_sep="|---|------|------|-------------|-------------|-------------"
if $HAS_CSHARP; then
  xml_header="$xml_header | C# 1T (ms) | C# 8T (ms)"
  xml_sep="$xml_sep|------------|------------"
fi
xml_header="$xml_header | Rust 1T / C# 1T | Rust 8T / C# 8T | JS / C# 1T"
xml_sep="$xml_sep|----------------|----------------|------------"
xml_header="$xml_header |"
xml_sep="$xml_sep|"

# ── Build JSON table header ─────────────────────────────────────────
json_header="| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms)"
json_sep="|---|------|------|-------------|-------------|-------------"
if $HAS_CSHARP; then
  json_header="$json_header | C# 1T (ms) | C# 8T (ms)"
  json_sep="$json_sep|------------|------------"
fi
if $HAS_RUST_WASM; then
  json_header="$json_header | Rust WASM (ms)"
  json_sep="$json_sep|---------------"
fi
if $HAS_CS_WASM; then
  json_header="$json_header | C# WASM (ms)"
  json_sep="$json_sep|--------------"
fi
json_header="$json_header | Rust 1T / C# 1T | Rust 8T / C# 8T | JS / C# 1T"
json_sep="$json_sep|----------------|----------------|------------"
if $HAS_RUST_WASM && $HAS_CS_WASM; then
  json_header="$json_header | Rust WASM / C# WASM"
  json_sep="$json_sep|--------------------"
fi
json_header="$json_header |"
json_sep="$json_sep|"

# ── Markdown header ─────────────────────────────────────────────────
{
  echo "# Parser Benchmark Comparison"
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
} > "$RESULTS"

# ── Storage for rows ────────────────────────────────────────────────
declare -a XML_ROWS=()
declare -a JSON_ROWS=()

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
  if ! node "$JS_CLI" "$file" -o json &>/dev/null; then
    echo "  ⚠ JS parser failed — skipping"
    XML_ROWS+=("| $i | $name | $size | – | – | FAIL | – | – | – | – | – |")
    JSON_ROWS+=("| $i | $name | $size | – | – | FAIL | – | – | – | – | – |")
    fail=$((fail + 1))
    continue
  fi

  # ── XML benchmark group ──────────────────────────────────────────
  echo "  XML benchmark..."
  xml_tmp=$(mktemp)
  declare -a xml_cmds=(
    --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null"
    --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null"
    --command-name "js-node" "node '$JS_CLI' '$file' -o xml > /dev/null"
  )
  xml_idx_rust1t=0
  xml_idx_rust8t=1
  xml_idx_js=2
  xml_next=3

  xml_idx_cs1t=-1; xml_idx_cs8t=-1

  if $HAS_CSHARP; then
    xml_cmds+=(--command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1 -o xml > /dev/null")
    xml_cmds+=(--command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8 -o xml > /dev/null")
    xml_idx_cs1t=$xml_next; xml_next=$((xml_next + 1))
    xml_idx_cs8t=$xml_next; xml_next=$((xml_next + 1))
  fi

  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$xml_tmp" \
    "${xml_cmds[@]}" \
    2>&1 | sed 's/^/    /'

  xml_rust1t=$(get_ms "$xml_tmp" $xml_idx_rust1t)
  xml_rust8t=$(get_ms "$xml_tmp" $xml_idx_rust8t)
  xml_js=$(get_ms "$xml_tmp" $xml_idx_js)

  xml_row="| $i | $name | $size | $xml_rust1t | $xml_rust8t | $xml_js"

  if $HAS_CSHARP; then
    xml_cs1t=$(get_ms "$xml_tmp" $xml_idx_cs1t)
    xml_cs8t=$(get_ms "$xml_tmp" $xml_idx_cs8t)
    xml_row="$xml_row | $xml_cs1t | $xml_cs8t"
    xml_row="$xml_row | $(ratio "$xml_rust1t" "$xml_cs1t")x | $(ratio "$xml_rust8t" "$xml_cs8t")x | $(ratio "$xml_js" "$xml_cs1t")x"
  else
    xml_row="$xml_row | – | – | –"
  fi

  XML_ROWS+=("$xml_row |")
  rm -f "$xml_tmp"

  # ── JSON benchmark group ─────────────────────────────────────────
  echo "  JSON benchmark..."
  json_tmp=$(mktemp)
  declare -a json_cmds=(
    --command-name "rust-1t" "'$RUST_BIN' -t 1 -o json '$file' > /dev/null"
    --command-name "rust-8t" "'$RUST_BIN' -t 8 -o json '$file' > /dev/null"
    --command-name "js-node" "node '$JS_CLI' '$file' -o json > /dev/null"
  )
  json_idx_rust1t=0
  json_idx_rust8t=1
  json_idx_js=2
  json_next=3

  json_idx_cs1t=-1; json_idx_cs8t=-1; json_idx_rust_wasm=-1; json_idx_cs_wasm=-1

  if $HAS_CSHARP; then
    json_cmds+=(--command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1 -o json > /dev/null")
    json_cmds+=(--command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8 -o json > /dev/null")
    json_idx_cs1t=$json_next; json_next=$((json_next + 1))
    json_idx_cs8t=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_RUST_WASM; then
    json_cmds+=(--command-name "rust-wasm" "node '$RUST_WASM_CLI' '$file' > /dev/null")
    json_idx_rust_wasm=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_CS_WASM; then
    json_cmds+=(--command-name "csharp-wasm" "node '$CS_WASM_CLI' '$file' > /dev/null")
    json_idx_cs_wasm=$json_next; json_next=$((json_next + 1))
  fi

  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$json_tmp" \
    "${json_cmds[@]}" \
    2>&1 | sed 's/^/    /'

  json_rust1t=$(get_ms "$json_tmp" $json_idx_rust1t)
  json_rust8t=$(get_ms "$json_tmp" $json_idx_rust8t)
  json_js=$(get_ms "$json_tmp" $json_idx_js)

  json_row="| $i | $name | $size | $json_rust1t | $json_rust8t | $json_js"

  if $HAS_CSHARP; then
    json_cs1t=$(get_ms "$json_tmp" $json_idx_cs1t)
    json_cs8t=$(get_ms "$json_tmp" $json_idx_cs8t)
    json_row="$json_row | $json_cs1t | $json_cs8t"
  fi

  if $HAS_RUST_WASM; then
    json_rust_wasm=$(get_ms "$json_tmp" $json_idx_rust_wasm)
    json_row="$json_row | $json_rust_wasm"
  fi

  if $HAS_CS_WASM; then
    json_cs_wasm=$(get_ms "$json_tmp" $json_idx_cs_wasm)
    json_row="$json_row | $json_cs_wasm"
  fi

  # Ratio columns (against C#)
  if $HAS_CSHARP; then
    json_row="$json_row | $(ratio "$json_rust1t" "$json_cs1t")x | $(ratio "$json_rust8t" "$json_cs8t")x | $(ratio "$json_js" "$json_cs1t")x"
  else
    json_row="$json_row | – | – | –"
  fi

  if $HAS_RUST_WASM && $HAS_CS_WASM; then
    json_row="$json_row | $(ratio "$json_rust_wasm" "$json_cs_wasm")x"
  fi

  JSON_ROWS+=("$json_row |")
  rm -f "$json_tmp"

  pass=$((pass + 1))
  echo ""
done

# ── Write XML table ─────────────────────────────────────────────────
{
  echo "## XML Output Benchmark"
  echo ""
  echo "> Ratio columns: X / C# — values >1.0x mean C# is faster"
  echo ""
  echo "$xml_header"
  echo "$xml_sep"
  for row in "${XML_ROWS[@]}"; do
    echo "$row"
  done
  echo ""
} >> "$RESULTS"

# ── Write JSON table ────────────────────────────────────────────────
{
  echo "## JSON Output Benchmark"
  echo ""
  echo "> Ratio columns: X / C# — values >1.0x mean C# is faster"
  echo ""
  echo "$json_header"
  echo "$json_sep"
  for row in "${JSON_ROWS[@]}"; do
    echo "$row"
  done
  echo ""
} >> "$RESULTS"

# ── Summary ─────────────────────────────────────────────────────────
{
  echo "## Summary"
  echo ""
  echo "- **Files tested:** ${#FILES[@]}"
  echo "- **Passed:** $pass"
  echo "- **Failed (JS):** $fail"
  if $HAS_CSHARP; then
    echo "- **C# native included:** yes"
  fi
  if $HAS_RUST_WASM; then
    echo "- **Rust WASM included:** yes"
  fi
  if $HAS_CS_WASM; then
    echo "- **C# WASM (AOT) included:** yes"
  fi
} >> "$RESULTS"

echo "========================================="
echo "Done! $pass passed, $fail failed"
echo "Results written to: $RESULTS"
echo "========================================="
