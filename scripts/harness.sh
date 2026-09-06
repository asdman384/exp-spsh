#!/usr/bin/env bash
#
# Verification harness for exp-spsh.
#
# The single command an agent runs to prove a change is green. Two layers:
#
#   build  -- `ng build --configuration=production`. This is the type-check;
#             there is no separate `npm run typecheck` or lint step in this repo.
#   test   -- `ng test --watch=false`, Angular's Vitest runner in headless Chromium.
#
# Usage:
#   bash scripts/harness.sh              # both layers (same as --all)
#   bash scripts/harness.sh --all
#   bash scripts/harness.sh --build
#   bash scripts/harness.sh --test
#   bash scripts/harness.sh --test --include src/shared/helpers/index.spec.ts
#
# Exits 0 only when every selected layer passes. Runs from anywhere -- it cd's to
# the repo root itself.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

run_build=0
run_test=0
include=""

while [ $# -gt 0 ]; do
  case "$1" in
    --all)     run_build=1; run_test=1 ;;
    --build)   run_build=1 ;;
    --test)    run_test=1 ;;
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

if [ "$run_build" -eq 0 ] && [ "$run_test" -eq 0 ]; then
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

build_status="skipped"
test_status="skipped"
failed=0

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
echo "  build: $build_status"
echo "  test:  $test_status"

if [ "$failed" -ne 0 ]; then
  echo "harness: FAILED"
  exit 1
fi

echo "harness: green"
exit 0
