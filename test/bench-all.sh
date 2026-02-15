#!/usr/bin/env bash
set -euo pipefail

# ── Parse flags ─────────────────────────────────────────────────────
NATIVE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --native-only) NATIVE_ONLY=true ;;
  esac
done

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

# External parsers directory (sibling to repo, won't be git-committed)
EXTERNAL_DIR="${EXTERNAL_DIR:-$ROOT_DIR/../evtx-external}"

# Hyperfine settings (env-overridable)
WARMUP="${HYPERFINE_WARMUP:-5}"
RUNS="${HYPERFINE_RUNS:-10}"

# Test data
TEST_DATA="$SCRIPT_DIR/data/benchmark"

# Output file
RESULTS="$SCRIPT_DIR/benchmark-comparison.md"

# ── Color helpers ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Helper functions ─────────────────────────────────────────────────
# Format hyperfine result as "275.9 ms ± 2.1 ms" or "2.439 s ± 0.035 s"
get_formatted() {
  node -e "
    const d = JSON.parse(require('fs').readFileSync('$1', 'utf8'));
    const r = d.results[$2];
    const mean = r.mean, sd = r.stddev;
    if (mean < 1.0) {
      console.log((mean*1000).toFixed(1) + ' ms ± ' + (sd*1000).toFixed(1) + ' ms');
    } else if (mean < 60.0) {
      console.log(mean.toFixed(3) + ' s ± ' + sd.toFixed(3) + ' s');
    } else {
      const m = Math.floor(mean / 60);
      const s = mean - m * 60;
      console.log(m + 'm' + s.toFixed(3) + 's ± ' + sd.toFixed(3) + ' s');
    }
  "
}

measure_cmd_once_seconds() {
  local cmd="$1"
  python3 - "$cmd" <<'PY'
import subprocess, sys, time
cmd = sys.argv[1]
start = time.perf_counter()
proc = subprocess.run(cmd, shell=True)
end = time.perf_counter()
if proc.returncode != 0:
    raise SystemExit(proc.returncode)
print(f"{end - start:.6f}")
PY
}

# Format single-run seconds as "0.367s (ran once)" or "2m41.075s (ran once)"
format_single_run() {
  python3 - "$1" <<'PY'
import sys
s = float(sys.argv[1])
if s >= 60.0:
    m = int(s // 60.0)
    rem = s - (m * 60.0)
    print(f"{m}m{rem:.3f}s (ran once)")
else:
    print(f"{s:.3f}s (ran once)")
PY
}

binary_looks_compatible() {
  local bin="$1"
  [[ -f "$bin" ]] || return 1

  if ! command -v file >/dev/null 2>&1; then
    return 0
  fi

  local os desc
  os="$(uname -s 2>/dev/null || echo unknown)"
  desc="$(file "$bin" 2>/dev/null || true)"

  case "$os" in
    Linux)  [[ "$desc" == *"Mach-O"* ]] && return 1 ;;
    Darwin) [[ "$desc" == *"ELF"* ]]    && return 1 ;;
  esac

  return 0
}

# ── External parser build/fetch functions ────────────────────────────

fetch_and_build_libevtx() {
  log_info "Setting up C libevtx..."
  local dir="$EXTERNAL_DIR/libevtx"

  if [[ ! -d "$dir" ]]; then
    log_info "Cloning libevtx..."
    git clone --quiet https://github.com/libyal/libevtx.git "$dir"
  fi

  local prev_dir="$PWD"
  cd "$dir"

  if [[ ! -f "evtxtools/evtxexport" ]] || ! binary_looks_compatible "evtxtools/evtxexport"; then
    log_info "Building libevtx (this may take a while)..."
    rm -f evtxtools/evtxexport 2>/dev/null || true

    if [[ ! -d "libcerror" ]]; then
      ./synclibs.sh 2>/dev/null
    fi

    if [[ ! -f "configure" ]]; then
      ./autogen.sh 2>/dev/null
    fi

    ./configure --enable-static --disable-shared --enable-static-executables \
      --quiet 2>/dev/null
    make -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)" --quiet 2>/dev/null
  fi

  cd "$prev_dir"
  log_success "C libevtx ready"
}

fetch_and_build_velocidex() {
  log_info "Setting up Go Velocidex evtx..."
  local dir="$EXTERNAL_DIR/velocidex-evtx"

  if [[ ! -d "$dir" ]]; then
    log_info "Cloning Velocidex evtx..."
    git clone --quiet https://github.com/Velocidex/evtx.git "$dir"
  fi

  local prev_dir="$PWD"
  cd "$dir"

  if [[ ! -f "dumpevtx" ]] || ! binary_looks_compatible "dumpevtx"; then
    log_info "Building Velocidex dumpevtx..."
    go build -o dumpevtx ./cmd/ 2>/dev/null
  fi

  cd "$prev_dir"
  log_success "Go Velocidex ready"
}

fetch_and_build_0xrawsec() {
  log_info "Setting up Go 0xrawsec evtx..."
  local dir="$EXTERNAL_DIR/0xrawsec-evtx"

  if [[ ! -d "$dir" ]]; then
    log_info "Cloning 0xrawsec evtx..."
    git clone --quiet https://github.com/0xrawsec/golang-evtx.git "$dir"
  fi

  local prev_dir="$PWD"
  cd "$dir"

  if [[ ! -f "evtxdump" ]] || ! binary_looks_compatible "evtxdump"; then
    log_info "Building 0xrawsec evtxdump..."

    # Fix missing Version/CommitID if needed
    if ! grep -q "Version.*=.*\"" tools/evtxdump/evtxdump.go 2>/dev/null; then
      sed -i.bak '/^const (/,/^)/{
        /conditions;`$/a\
	Version  = "dev"\
	CommitID = "unknown"
      }' tools/evtxdump/evtxdump.go 2>/dev/null || true
    fi

    go build -o evtxdump ./tools/evtxdump/ 2>/dev/null
  fi

  cd "$prev_dir"
  log_success "Go 0xrawsec ready"
}

fetch_and_setup_python_evtx() {
  log_info "Setting up Python python-evtx..."
  local dir="$EXTERNAL_DIR/python-evtx"

  if [[ ! -d "$dir" ]]; then
    log_info "Cloning python-evtx..."
    git clone --quiet https://github.com/williballenthin/python-evtx.git "$dir"
  fi

  local prev_dir="$PWD"
  cd "$dir"

  # Setup with CPython
  if [[ ! -d ".venv-cpython" ]]; then
    log_info "Setting up CPython venv..."
    uv venv --python 3.13 .venv-cpython 2>/dev/null
    uv pip install --quiet -p .venv-cpython/bin/python -e . 2>/dev/null
  fi

  # Setup with PyPy
  if [[ ! -d ".venv-pypy" ]]; then
    log_info "Setting up PyPy venv..."
    uv python install pypy3.10 2>/dev/null || true
    if uv venv --python pypy3.10 .venv-pypy 2>/dev/null; then
      uv pip install --quiet -p .venv-pypy/bin/python -e . 2>/dev/null
    else
      log_warn "PyPy setup failed, skipping"
    fi
  fi

  cd "$prev_dir"
  log_success "Python python-evtx ready"
}

# ── Preflight ────────────────────────────────────────────────────────
if ! command -v hyperfine &>/dev/null; then
  log_error "hyperfine not found. Install with: brew install hyperfine"
  exit 1
fi

if [[ ! -x "$RUST_BIN" ]]; then
  log_error "Rust binary not found at $RUST_BIN"
  echo "Build it with: cd evtx-master && cargo build --release" >&2
  exit 1
fi

# Bundle JS benchmark (removes tsx transpilation overhead from measurements)
HAS_JS=false
if ! $NATIVE_ONLY; then
  echo "Bundling JS benchmark..."
  npx --yes esbuild "$JS_CLI_SRC" --bundle --platform=node --format=esm --outfile="$JS_CLI" --log-level=warning
  echo "  JS bundle ready at $JS_CLI"
  HAS_JS=true
fi

# Build C# bench binary if project exists
HAS_CSHARP=false
if [[ -f "$CSHARP_PROJECT" ]]; then
  echo "Building C# bench binary..."
  if dotnet publish "$CSHARP_PROJECT" -c Release -o "$(dirname "$CSHARP_BIN")" --nologo -v quiet 2>/dev/null; then
    HAS_CSHARP=true
    echo "  C# binary ready at $CSHARP_BIN"
  else
    log_warn "C# build failed — skipping C# benchmarks"
  fi
fi

# Check for C# WASM build
HAS_CS_WASM=false
HAS_RUST_WASM=false
HAS_LIBEVTX=false
HAS_VELOCIDEX=false
HAS_0XRAWSEC=false
HAS_PYTHON_EVTX=false
HAS_PYTHON_EVTX_PYPY=false
HAS_PYEVTX_RS=false

if ! $NATIVE_ONLY; then
  if [[ -d "$CS_WASM_FRAMEWORK" && -f "$CS_WASM_CLI" ]]; then
    HAS_CS_WASM=true
    echo "  C# WASM benchmark ready"
  else
    log_warn "C# WASM not found — run 'npm run build:wasm' in evtx-parser-react/ to enable"
  fi

  # Check for Rust WASM build
  if [[ -f "$RUST_WASM_PKG/evtx_wasm.js" && -f "$RUST_WASM_CLI" ]]; then
    HAS_RUST_WASM=true
    echo "  Rust WASM benchmark ready"
  else
    log_warn "Rust WASM not found — run 'cd evtx-master/evtx-wasm && wasm-pack build --target nodejs --release' to enable"
  fi

  # ── External parsers preflight ───────────────────────────────────────
  mkdir -p "$EXTERNAL_DIR"

  # Check for go
  if command -v go &>/dev/null; then
    # Build Velocidex
    fetch_and_build_velocidex || log_warn "Velocidex build failed"
    if [[ -x "$EXTERNAL_DIR/velocidex-evtx/dumpevtx" ]]; then
      HAS_VELOCIDEX=true
    fi

    # Build 0xrawsec
    fetch_and_build_0xrawsec || log_warn "0xrawsec build failed"
    if [[ -x "$EXTERNAL_DIR/0xrawsec-evtx/evtxdump" ]]; then
      HAS_0XRAWSEC=true
    fi
  else
    log_warn "go not found — skipping Velocidex and 0xrawsec benchmarks"
  fi

  # Check for libevtx build deps
  if command -v git &>/dev/null && command -v make &>/dev/null; then
    fetch_and_build_libevtx || log_warn "libevtx build failed"
    if [[ -x "$EXTERNAL_DIR/libevtx/evtxtools/evtxexport" ]]; then
      HAS_LIBEVTX=true
    fi
  else
    log_warn "git/make not found — skipping libevtx benchmark"
  fi

  # Check for uv + python3 (python-evtx + pyevtx-rs)
  if command -v uv &>/dev/null && command -v python3 &>/dev/null; then
    fetch_and_setup_python_evtx || log_warn "python-evtx setup failed"
    if [[ -d "$EXTERNAL_DIR/python-evtx/.venv-cpython" ]]; then
      HAS_PYTHON_EVTX=true
    fi
    if [[ -d "$EXTERNAL_DIR/python-evtx/.venv-pypy" ]]; then
      HAS_PYTHON_EVTX_PYPY=true
    fi

    # pyevtx-rs: warm uv cache
    if uv run --with evtx python -c 'import evtx' >/dev/null 2>&1; then
      HAS_PYEVTX_RS=true
      log_success "pyevtx-rs ready"
    else
      log_warn "pyevtx-rs install failed — skipping"
    fi
  else
    log_warn "uv/python3 not found — skipping python-evtx and pyevtx-rs benchmarks"
  fi
else
  log_info "Running in --native-only mode (C# + Rust only)"
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

# ── Build unified table header ───────────────────────────────────────
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

# ── Markdown header ─────────────────────────────────────────────────
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

  # ── XML benchmark group ──────────────────────────────────────────
  echo "  XML benchmark..."
  xml_tmp=$(mktemp)
  declare -a xml_cmds=(
    --command-name "rust-1t" "'$RUST_BIN' -t 1 '$file' > /dev/null"
    --command-name "rust-8t" "'$RUST_BIN' -t 8 '$file' > /dev/null"
  )
  xml_idx_rust1t=0
  xml_idx_rust8t=1
  xml_next=2

  xml_idx_js=-1
  if $HAS_JS; then
    xml_cmds+=(--command-name "js-node" "node '$JS_CLI' '$file' -o xml > /dev/null")
    xml_idx_js=$xml_next; xml_next=$((xml_next + 1))
  fi

  xml_idx_cs1t=-1; xml_idx_cs8t=-1; xml_idx_libevtx=-1

  if $HAS_CSHARP; then
    xml_cmds+=(--command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1 -o xml > /dev/null")
    xml_cmds+=(--command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8 -o xml > /dev/null")
    xml_idx_cs1t=$xml_next; xml_next=$((xml_next + 1))
    xml_idx_cs8t=$xml_next; xml_next=$((xml_next + 1))
  fi

  if $HAS_LIBEVTX; then
    xml_cmds+=(--command-name "libevtx" "'$EXTERNAL_DIR/libevtx/evtxtools/evtxexport' -f xml '$file' > /dev/null")
    xml_idx_libevtx=$xml_next; xml_next=$((xml_next + 1))
  fi

  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$xml_tmp" \
    "${xml_cmds[@]}" \
    2>&1 | sed 's/^/    /'

  xml_row="| $file_label (XML)"

  # C# native
  if $HAS_CSHARP; then
    xml_row="$xml_row | $(get_formatted "$xml_tmp" $xml_idx_cs1t) | $(get_formatted "$xml_tmp" $xml_idx_cs8t)"
  fi
  # C# WASM — XML not ran (web-only)
  if $HAS_CS_WASM; then
    xml_row="$xml_row | not ran bc it's for web"
  fi
  # Rust native
  xml_row="$xml_row | $(get_formatted "$xml_tmp" $xml_idx_rust1t) | $(get_formatted "$xml_tmp" $xml_idx_rust8t)"
  # Rust WASM — XML not ran (web-only)
  if $HAS_RUST_WASM; then
    xml_row="$xml_row | not ran bc it's for web"
  fi
  # JS Node
  if $HAS_JS; then
    xml_row="$xml_row | $(get_formatted "$xml_tmp" $xml_idx_js)"
  fi
  # libevtx (C)
  if $HAS_LIBEVTX; then
    xml_row="$xml_row | $(get_formatted "$xml_tmp" $xml_idx_libevtx)"
  fi
  # velocidex — XML not supported
  if $HAS_VELOCIDEX; then
    xml_row="$xml_row | No support"
  fi
  # 0xrawsec — XML not supported
  if $HAS_0XRAWSEC; then
    xml_row="$xml_row | No support"
  fi
  # pyevtx-rs (single run)
  if $HAS_PYEVTX_RS; then
    echo "    pyevtx-rs XML (single run)..."
    if pyrs_xml_secs=$(measure_cmd_once_seconds "uv run --with evtx python -c 'import sys, collections; from evtx import PyEvtxParser; p=PyEvtxParser(sys.argv[1]); collections.deque((sys.stdout.write(r[\"data\"] + \"\\n\") for r in p.records()), maxlen=0)' '$file' > /dev/null" 2>/dev/null); then
      xml_row="$xml_row | $(format_single_run "$pyrs_xml_secs")"
      echo "      $(format_single_run "$pyrs_xml_secs")"
    else
      xml_row="$xml_row | ERR"
    fi
  fi

  # python-evtx CPython (single run, too slow for hyperfine)
  if $HAS_PYTHON_EVTX; then
    echo "    python-evtx CPython (single run)..."
    local_python="$EXTERNAL_DIR/python-evtx/.venv-cpython/bin/python"
    local_script="$EXTERNAL_DIR/python-evtx/evtx_scripts/evtx_dump.py"
    if py_secs=$(measure_cmd_once_seconds "PYTHON_JIT=1 '$local_python' '$local_script' '$file' > /dev/null" 2>/dev/null); then
      xml_row="$xml_row | $(format_single_run "$py_secs")"
      echo "      $(format_single_run "$py_secs")"
    else
      xml_row="$xml_row | ERR"
    fi
  fi

  # python-evtx PyPy (single run)
  if $HAS_PYTHON_EVTX_PYPY; then
    echo "    python-evtx PyPy (single run)..."
    local_pypy="$EXTERNAL_DIR/python-evtx/.venv-pypy/bin/python"
    local_script="$EXTERNAL_DIR/python-evtx/evtx_scripts/evtx_dump.py"
    if pypy_secs=$(measure_cmd_once_seconds "'$local_pypy' '$local_script' '$file' > /dev/null" 2>/dev/null); then
      xml_row="$xml_row | $(format_single_run "$pypy_secs")"
      echo "      $(format_single_run "$pypy_secs")"
    else
      xml_row="$xml_row | ERR"
    fi
  fi

  ROWS+=("$xml_row |")

  rm -f "$xml_tmp"

  # ── JSON benchmark group ─────────────────────────────────────────
  echo "  JSON benchmark..."
  json_tmp=$(mktemp)
  declare -a json_cmds=(
    --command-name "rust-1t" "'$RUST_BIN' -t 1 -o json '$file' > /dev/null"
    --command-name "rust-8t" "'$RUST_BIN' -t 8 -o json '$file' > /dev/null"
  )
  json_idx_rust1t=0
  json_idx_rust8t=1
  json_next=2

  json_idx_js=-1
  if $HAS_JS; then
    json_cmds+=(--command-name "js-node" "node '$JS_CLI' '$file' -o json > /dev/null")
    json_idx_js=$json_next; json_next=$((json_next + 1))
  fi

  json_idx_cs1t=-1; json_idx_cs8t=-1; json_idx_rust_wasm=-1; json_idx_cs_wasm=-1
  json_idx_velocidex=-1; json_idx_0xrawsec=-1

  if $HAS_CSHARP; then
    json_cmds+=(--command-name "csharp-1t" "'$CSHARP_BIN' '$file' -t 1 -o json > /dev/null")
    json_cmds+=(--command-name "csharp-8t" "'$CSHARP_BIN' '$file' -t 8 -o json > /dev/null")
    json_idx_cs1t=$json_next; json_next=$((json_next + 1))
    json_idx_cs8t=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_CS_WASM; then
    json_cmds+=(--command-name "csharp-wasm" "node '$CS_WASM_CLI' '$file' > /dev/null")
    json_idx_cs_wasm=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_RUST_WASM; then
    json_cmds+=(--command-name "rust-wasm" "node '$RUST_WASM_CLI' '$file' > /dev/null")
    json_idx_rust_wasm=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_VELOCIDEX; then
    json_cmds+=(--command-name "velocidex" "'$EXTERNAL_DIR/velocidex-evtx/dumpevtx' parse '$file' > /dev/null")
    json_idx_velocidex=$json_next; json_next=$((json_next + 1))
  fi

  if $HAS_0XRAWSEC; then
    json_cmds+=(--command-name "0xrawsec" "'$EXTERNAL_DIR/0xrawsec-evtx/evtxdump' '$file' > /dev/null")
    json_idx_0xrawsec=$json_next; json_next=$((json_next + 1))
  fi

  hyperfine --warmup "$WARMUP" --runs "$RUNS" --style basic \
    --export-json "$json_tmp" \
    "${json_cmds[@]}" \
    2>&1 | sed 's/^/    /'

  json_row="| $file_label (JSON)"

  # C# native
  if $HAS_CSHARP; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_cs1t) | $(get_formatted "$json_tmp" $json_idx_cs8t)"
  fi
  # C# WASM
  if $HAS_CS_WASM; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_cs_wasm)"
  fi
  # Rust native
  json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_rust1t) | $(get_formatted "$json_tmp" $json_idx_rust8t)"
  # Rust WASM
  if $HAS_RUST_WASM; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_rust_wasm)"
  fi
  # JS Node
  if $HAS_JS; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_js)"
  fi
  # libevtx — JSON not supported
  if $HAS_LIBEVTX; then
    json_row="$json_row | No support"
  fi
  # velocidex
  if $HAS_VELOCIDEX; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_velocidex)"
  fi
  # 0xrawsec
  if $HAS_0XRAWSEC; then
    json_row="$json_row | $(get_formatted "$json_tmp" $json_idx_0xrawsec)"
  fi

  # pyevtx-rs (single run via measure_cmd_once_seconds)
  if $HAS_PYEVTX_RS; then
    echo "    pyevtx-rs JSON (single run)..."
    if pyrs_secs=$(measure_cmd_once_seconds "uv run --with evtx python -c 'import sys, collections; from evtx import PyEvtxParser; p=PyEvtxParser(sys.argv[1]); collections.deque((sys.stdout.write(r[\"data\"] + \"\\n\") for r in p.records_json()), maxlen=0)' '$file' > /dev/null" 2>/dev/null); then
      json_row="$json_row | $(format_single_run "$pyrs_secs")"
      echo "      $(format_single_run "$pyrs_secs")"
    else
      json_row="$json_row | ERR"
    fi
  fi

  # python-evtx CPython — JSON not supported
  if $HAS_PYTHON_EVTX; then
    json_row="$json_row | No support"
  fi
  # python-evtx PyPy — JSON not supported
  if $HAS_PYTHON_EVTX_PYPY; then
    json_row="$json_row | No support"
  fi

  ROWS+=("$json_row |")

  rm -f "$json_tmp"

  pass=$((pass + 1))
  echo ""
done

# ── Write benchmark table ───────────────────────────────────────────
{
  echo "## Benchmark Results"
  echo ""
  echo "$tbl_header"
  echo "$tbl_sep"
  for row in "${ROWS[@]}"; do
    echo "$row"
  done
  echo ""
  echo "**Note**: Numbers shown are \`real-time\` measurements (wall-clock time for invocation to complete). Single-run entries are marked with *(ran once)* — these parsers are too slow for repeated benchmarking via hyperfine."
  echo ""
} >> "$RESULTS"

# ── Summary ─────────────────────────────────────────────────────────
{
  echo "## Summary"
  echo ""
  echo "- **Files tested:** ${#FILES[@]}"
  echo "- **Passed:** $pass"
  $HAS_JS && echo "- **Failed (JS):** $fail"
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

echo "========================================="
echo "Done! $pass passed, $fail failed"
echo "Results written to: $RESULTS"
echo "========================================="
