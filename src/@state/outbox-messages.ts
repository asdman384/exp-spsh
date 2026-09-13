/**
 * Copy for the outbox's non-toast feedback (D12/D13 of `docs/specs/write-outbox.md`). Kept
 * separate from `src/@state/report-failure.ts`'s `FAILURE_MESSAGES`, which stays unchanged.
 */
export const OUTBOX_MESSAGES = {
  queued: 'Expense saved on this device. It will be sent to your spreadsheet automatically.',
  allSent: 'All saved expenses were sent to your spreadsheet.',
  authBlocked:
    "Your saved expenses couldn't be sent because your Google sign-in needs renewing. They're kept on this device."
} as const;
