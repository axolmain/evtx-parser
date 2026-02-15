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

# ── Build table header dynamically ──────────────────────────────────
header="| # | File | Size | Rust 1T (ms) | Rust 8T (ms) | JS Node (ms)"
sep="|---|------|------|-------------|-------------|-------------"
if $HAS_CSHARP; then
  header="$header | C# 1T (ms) | C# 8T (ms)"
  sep="$sep|------------|------------"
fi
if $HAS_RUST_WASM; then
  header="$header | Rust WASM (ms)"
  sep="$sep|---------------"
fi
if $HAS_CS_WASM; then
  header="$header | C# WASM (ms)"
  sep="$sep|--------------"
fi
header="$header | JS / Rust 1T"
sep="$sep|-------------"
if $HAS_CSHARP; then
  header="$header | C# 1T / Rust 1T | C# 8T / Rust 8T"
  sep="$sep|----------------|----------------"
fi
if $HAS_RUST_WASM; then
  header="$header | Rust WASM / Rust 1T"
  sep="$sep|--------------------"
fi
if $HAS_CS_WASM; then
  header="$header | C# WASM / Rust 1T"
  sep="$sep|------------------"
fi
header="$header |"
sep="$sep|"

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
  echo "$header"
  echo "$sep"
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
  if ! node "$JS_CLI" "$file" &>/dev/null; then
    echo "  ⚠ JS parser failed — skipping (Rust-only result)"
    rust1t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 1 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    rust8t=$(hyperfine --warmup "$WARMUP" --runs "$RUNS" --style none \
      "'$RUST_BIN' -t 8 '$file' > /dev/null" 2>&1 | grep -oP '[\d.]+(?= ms)' | head -1 || echo "–")
    row="| $i | $name | $size | $rust1t | $rust8t | FAIL"
    if $HAS_CSHARP; then row="$row | – | –"; fi
    if $HAS_RUST_WASM; then row="$row | –"; fi
    if $HAS_CS_WASM; then row="$row | –"; fi
    row="$row | –"
    if $HAS_CSHARP; then row="$row | – | –"; fi
    if $HAS_RUST_WASM; then row="$row | –"; fi
    if $HAS_CS_WASM; then row="$row | –"; fi
    echo "$row |" >> "$RESULTS"
    fail=$((fail + 1))
    continue
  fi

  # Build hyperfine commands dynamically
  tmp=$(mktemp)
  declare -a cmds=(
    --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null"
    --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null"
    --command-name "js-node" "node '$JS_CLI' '$file' > /dev/null"
  )
  idx_rust1t=0
  idx_rust8t=1
  idx_js=2
  next_idx=3

  idx_cs1t=-1; idx_cs8t=-1; idx_rust_wasm=-1; idx_cs_wasm=-1

  if $HAS_CSHARP; then
    cmds+=(--command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1 > /dev/null")
    cmds+=(--command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8 > /dev/null")
    idx_cs1t=$next_idx; next_idx=$((next_idx + 1))
    idx_cs8t=$next_idx; next_idx=$((next_idx + 1))
  fi

  if $HAS_RUST_WASM; then
    cmds+=(--command-name "rust-wasm" "node '$RUST_WASM_CLI' '$file' > /dev/null")
    idx_rust_wasm=$next_idx; next_idx=$((next_idx + 1))
  fi

  if $HAS_CS_WASM; then
    cmds+=(--command-name "csharp-wasm" "node '$CS_WASM_CLI' '$file' > /dev/null")
    idx_cs_wasm=$next_idx; next_idx=$((next_idx + 1))
  fi

  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$tmp" \
    "${cmds[@]}" \
    2>&1 | sed 's/^/  /'

  # Helper to extract mean ms from JSON by index
  get_ms() { node -e "const d=JSON.parse(require('fs').readFileSync('$tmp','utf8')); console.log((d.results[$1].mean*1000).toFixed(1))"; }
  ratio() { node -e "console.log(($1 / $2).toFixed(1))"; }

  rust1t=$(get_ms $idx_rust1t)
  rust8t=$(get_ms $idx_rust8t)
  js_ms=$(get_ms $idx_js)

  row="| $i | $name | $size | $rust1t | $rust8t | $js_ms"

  if $HAS_CSHARP; then
    cs1t_ms=$(get_ms $idx_cs1t)
    cs8t_ms=$(get_ms $idx_cs8t)
    row="$row | $cs1t_ms | $cs8t_ms"
  fi

  if $HAS_RUST_WASM; then
    rust_wasm_ms=$(get_ms $idx_rust_wasm)
    row="$row | $rust_wasm_ms"
  fi

  if $HAS_CS_WASM; then
    cs_wasm_ms=$(get_ms $idx_cs_wasm)
    row="$row | $cs_wasm_ms"
  fi

  row="$row | $(ratio "$js_ms" "$rust1t")x"

  if $HAS_CSHARP; then
    row="$row | $(ratio "$cs1t_ms" "$rust1t")x | $(ratio "$cs8t_ms" "$rust8t")x"
  fi

  if $HAS_RUST_WASM; then
    row="$row | $(ratio "$rust_wasm_ms" "$rust1t")x"
  fi

  if $HAS_CS_WASM; then
    row="$row | $(ratio "$cs_wasm_ms" "$rust1t")x"
  fi

  echo "$row |" >> "$RESULTS"

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
