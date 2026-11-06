# Dates you can trust - work log

Scope: idea 2 in `docs/ideas/2026-10-25-spending-expert.md`.

1. Read project rules, ub-mode, and the add/load flows to identify date ownership.
2. Checked open task records and the working tree. Preserved the user's idea-file edits.
3. Added clock and visibility regression tests before implementation. Two tests failed on
   the stale timestamp and missing next-day refresh; 21 existing tests passed.
4. Added automatic versus selected date state in the page view-model. One update path
   changes the date and loads the selected scope. Visibility subscriptions end with the page.
5. Added Yesterday using calendar arithmetic and removed the lower date bound.
6. Added a component test for Yesterday on January 1 and previous-year date access.
   The existing manual-date submit test now sends the calendar selection event before setup.
7. Updated current-behavior documentation and the glossary.

Validation:
- Regression run before the fix: 2 expected failures, 21 passes.
- Full harness: lint, typecheck, and production build pass; first full test run: 321 pass, 1 fails, 2 skipped.
- Production warnings concern the existing snow style budget and Gemini's CommonJS dependency.
- Visual verification could not run: Computer Use stopped because it could not determine
  the Windows Chrome URL with enough confidence to enforce policy. No UI actions followed.
- The failed existing table test looks in the amount column, but HEAD renders queued icons
  in the category column. Changed only its selector to `.queued-icon`; all assertions remain.
  Corrected the table contract description. The final full harness passes after this repair.
- Final `node scripts/harness.mjs`: lint, typecheck, production build, and tests pass.
  Tests: 322 passed, 2 existing skipped; 27 files passed, 1 existing skipped.
- `git diff --check` passes.
- Stopped the two initial slow test launches before the successful regression run.
  All later harness processes completed; no session-started background process remains.
- Stored logs in `tmp/`. Saved the test repair and date feature as separate local commits.
  The user's existing idea-file edits are excluded from both commits.

Limits: no ADLC health configuration or appUrl is configured. The project harness is the
verification gate. crapper, dryer, and mutator tools are not available in this session.
No extra worktrees were created; the only worktree is the active checkout. No push is made.
