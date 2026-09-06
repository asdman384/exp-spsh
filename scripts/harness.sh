#!/usr/bin/env bash
#
# Verification harness for exp-spsh.
#
# The single command an agent runs to prove a change is green. Four layers,
# cheapest first:
#
#   lint      -- `ng lint` (ESLint + angular-eslint) over src/**/*.ts and
#                src/**/*.html.
#   typecheck -- `tsc -b tsconfig.app.json tsconfig.spec.json`. Plain
#                TypeScript project-reference build, incremental. Covers
#                *.spec.ts too, which `build` does not compile and which
#                Vitest's esbuild transpile does not type-check.
#   build     -- `ng build --configuration=production`. Full Angular AOT
#                compile of the production bundle.
#   test      -- `ng test --watch=false`, Angular's Vitest runner in headless
#                Chromium.
#
# Usage:
#   bash scripts/harness.sh              # all four layers (same as --all)
#   bash scripts/harness.sh --all
#   bash scripts/harness.sh --lint
#   bash scripts/harness.sh --typecheck
#   bash scripts/harness.sh --build
#   bash scripts/harness.sh --test
#   bash scripts/harness.sh --test --include src/shared/helpers/index.spec.ts
#
# Exits 0 only when every selected layer passes. Runs from anywhere -- it cd's to
# the repo root itself.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

run_lint=0
run_typecheck=0
run_build=0
run_test=0
include=""

while [ $# -gt 0 ]; do
  case "$1" in
    --all)        run_lint=1; run_typecheck=1; run_build=1; run_test=1 ;;
    --lint)       run_lint=1 ;;
    --typecheck)  run_typecheck=1 ;;
    --build)      run_build=1 ;;
    --test)       run_test=1 ;;
    --include) shift; include="${1:-}"
               if [ -z "$include" ]; then
                 echo "harness: --include needs a path or glob" >&2
                 exit 2
               fi ;;
    -h|--help) awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *)         echo "harness: unknown argument '$1'" >&2; exit 2 ;;
  esac
  shift
done

if [ "$run_lint" -eq 0 ] && [ "$run_typecheck" -eq 0 ] && [ "$run_build" -eq 0 ] && [ "$run_test" -eq 0 ]; then
  run_lint=1
  run_typecheck=1
  run_build=1
  run_test=1
fi

# keys.json is imported as a module by SpreadsheetService and both security
# services. Without it the build fails on module resolution, which reads as a
# confusing compile error rather than a missing-config error.
if [ ! -f keys.json ]; then
  echo "harness: keys.json is missing -- copy keys.example.json and fill it in." >&2
  echo "         Every build imports it directly; nothing will compile without it." >&2
  exit 2
fi

lint_status="skipped"
typecheck_status="skipped"
build_status="skipped"
test_status="skipped"
failed=0

if [ "$run_lint" -eq 1 ]; then
  echo "=== harness: lint (ESLint + angular-eslint) ==="
  if npx ng lint; then
    lint_status="passed"
  else
    lint_status="FAILED"
    failed=1
  fi
  echo
fi

if [ "$run_typecheck" -eq 1 ]; then
  echo "=== harness: typecheck (tsc -b, app + spec) ==="
  if npx tsc -b tsconfig.app.json tsconfig.spec.json; then
    typecheck_status="passed"
  else
    typecheck_status="FAILED"
    failed=1
  fi
  echo
fi

if [ "$run_build" -eq 1 ]; then
  echo "=== harness: build (type-check + production bundle) ==="
  if npx ng build --configuration=production; then
    build_status="passed"
  else
    build_status="FAILED"
    failed=1
  fi
  echo
fi

if [ "$run_test" -eq 1 ]; then
  echo "=== harness: test (headless Chromium) ==="
  if [ -n "$include" ]; then
    echo "--- restricted to: $include"
    npx ng test --watch=false --include "$include"
  else
    npx ng test --watch=false
  fi
  if [ $? -eq 0 ]; then
    test_status="passed"
  else
    test_status="FAILED"
    failed=1
  fi
  echo
fi

echo "=== harness summary ==="
echo "  lint:      $lint_status"
echo "  typecheck: $typecheck_status"
echo "  build:     $build_status"
echo "  test:      $test_status"

if [ "$failed" -ne 0 ]; then
  echo "harness: FAILED"
  exit 1
fi

echo "harness: green"
exit 0
