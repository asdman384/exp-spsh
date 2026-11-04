## TL;DR

Add daily, month-through-day, and signed Debt totals from the existing expense signal. Queued expenses remain excluded until send and reload. Keep ExpensesService unchanged.

## Reference

[Requirements](requirements.md)

## Design Decisions

The owner removes all request tracking, result identity, load status, cancellation tokens, and delete ownership changes from scope on 2026-11-05. The summary uses the current service rows without distinguishing initial, retained, offline, or failed-load data. No extra request or expense store is added.

Daily totals use the existing daily computed signal. Month and Debt totals filter service rows from the selected local month's first midnight through the selected day's final millisecond. Missing or invalid dates are excluded. Only finite numeric amounts contribute. Debt contributes to the regular totals and its signed subtotal.

Daily and month totals use exactly two decimals. Debt uses zero to two decimals. All use English decimal-point formatting without grouping or currency. Rounded negative zero displays as zero; non-finite aggregates display Unavailable. Today applies to today's local date; other dates use Daily. With no person, show Select a person to view totals.

## Implementation Chunks

### Chunk 1 — Add the summary

- [x] Compute daily, monthly, and Debt amounts, labels, and no-person text in DashboardPageViewModel. Keep date/person form state consistent. Make no additional requests for totals.
- [x] Bind and render the summary after the form and before the table. Add wrapping and long-value overflow protection.
- [x] Preserve existing tests and add numeric, date-boundary, invalid-data, empty-data, queued/manual/voice, reactivity, request-count, and rendered-placement coverage.
- [x] Update CLAUDE.md and relevant knowledge concepts to describe the summary. Record history in knowledge/log.md.
- [x] Run node scripts/harness.mjs, resolve failures, and verify summary wrapping at 320 CSS pixels and 200% text size. Record results and limitations.

## Verification notes

The optional .claude/repo_config files are absent. CLAUDE.md supplies the harness and local application URL. The existing empty playground lifecycle method fails lint; remove that unused method to restore the verification gate.

2026-11-05 — Verification: full harness lint, production build, and 298 tests pass (two pre-existing skips). The typecheck initially caught a nullable querySelector in the new test; after correction, node scripts/harness.mjs --typecheck passes. The repeated typecheck skips lint/build/test because those stages already passed. Chromium component coverage verifies 320 CSS-pixel summary width and 200% text with long amounts. Manual app inspection is unavailable: Chrome is not exposed and the in-app browser fails to attach. No configured appUrl exists, so the skill visual check is skipped; no screenshot is claimed. No task-started process remains running.
