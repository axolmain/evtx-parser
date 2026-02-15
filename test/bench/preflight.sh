#!/usr/bin/env bash
# Preflight checks: verify required tools, build parsers, set HAS_* flags.
# Expects all path variables and NATIVE_ONLY set by bench-all.sh.

run_preflight() {
  # ── Required tools ──────────────────────────────────────────────────
  if ! command -v hyperfine &>/dev/null; then
    log_error "hyperfine not found. Install with: brew install hyperfine"
    exit 1
  fi

  if ! command -v cargo &>/dev/null; then
    log_error "cargo not found. Install Rust: https://rustup.rs"
    exit 1
  fi

  # ── Build Rust evtx parser ──────────────────────────────────────────
  mkdir -p "$EXTERNAL_DIR"
  fetch_and_build_rust_evtx

  if [[ ! -x "$RUST_BIN" ]]; then
    log_error "Rust binary not found at $RUST_BIN after build"
    exit 1
  fi

  # ── JS bundle ───────────────────────────────────────────────────────
  HAS_JS=false
  if ! $NATIVE_ONLY; then
    echo "Bundling JS benchmark..."
    npx --yes esbuild "$JS_CLI_SRC" --bundle --platform=node --format=esm --outfile="$JS_CLI" --log-level=warning
    echo "  JS bundle ready at $JS_CLI"
    HAS_JS=true
  fi

  # ── C# native build ────────────────────────────────────────────────
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

  # ── WASM / external parser flags ────────────────────────────────────
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

    if [[ ! -f "$RUST_WASM_PKG/evtx_wasm.js" ]]; then
      build_rust_wasm || log_warn "Rust WASM build failed"
    fi
    if [[ -f "$RUST_WASM_PKG/evtx_wasm.js" && -f "$RUST_WASM_CLI" ]]; then
      HAS_RUST_WASM=true
      echo "  Rust WASM benchmark ready"
    fi

    # ── External parsers ────────────────────────────────────────────────
    if command -v go &>/dev/null; then
      fetch_and_build_velocidex || log_warn "Velocidex build failed"
      if [[ -x "$EXTERNAL_DIR/velocidex-evtx/dumpevtx" ]]; then
        HAS_VELOCIDEX=true
      fi

      fetch_and_build_0xrawsec || log_warn "0xrawsec build failed"
      if [[ -x "$EXTERNAL_DIR/0xrawsec-evtx/evtxdump" ]]; then
        HAS_0XRAWSEC=true
      fi
    else
      log_warn "go not found — skipping Velocidex and 0xrawsec benchmarks"
    fi

    if command -v git &>/dev/null && command -v make &>/dev/null; then
      fetch_and_build_libevtx || log_warn "libevtx build failed"
      if [[ -x "$EXTERNAL_DIR/libevtx/evtxtools/evtxexport" ]]; then
        HAS_LIBEVTX=true
      fi
    else
      log_warn "git/make not found — skipping libevtx benchmark"
    fi

    if command -v uv &>/dev/null && command -v python3 &>/dev/null; then
      fetch_and_setup_python_evtx || log_warn "python-evtx setup failed"
      if [[ -d "$EXTERNAL_DIR/python-evtx/.venv-cpython" ]]; then
        HAS_PYTHON_EVTX=true
      fi
      if [[ -d "$EXTERNAL_DIR/python-evtx/.venv-pypy" ]]; then
        HAS_PYTHON_EVTX_PYPY=true
      fi

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
}
