# Spending-expert review — 2026-10-25

## Summary

Today exp-spsh works well for a disciplined person, or a household, who already knows their
categories, wants their data in their own Google Sheet, and does their analysis there.
Logging is quick: a short form, or a voice note in Russian, Ukrainian, Polish or English that
Gemini splits into categories. Logging also works offline through the outbox. The biggest
gap is that the app records spending but gives almost nothing back. The dashboard shows no
totals. Statistics show one month as an unsorted list with no comparison, no limits and no
forecast. And whatever you just logged (typed offline, or recognised by voice) is invisible
until the spreadsheet confirms it.

Top 3 ideas:
1. Show queued expenses in the list right away, and let the user discard them offline (#1).
2. Make the recorded date trustworthy: a stale form date and the January cut-off put
   expenses on the wrong day (#2).
3. Add a "Today / This month" running total under the form, which later carries per-category
   limits (#3, then #8).

## User journeys

### First launch and setup
Steps: open the app, sign in with a Google redirect, consent, and land on Setup. Setup shows
three read-only id fields and a **Choose spreadsheet** button. The Picker then needs a
spreadsheet that **already exists**: there is no "create one for me" option, so a new user has
to leave the app, create a blank file in Google Sheets, come back and pick it. Next comes
**finish**, then the Dashboard, where the Category select is empty ("Click to Load"). The
user has to find **Categories** in the avatar menu and type each category one by one, with no
starter set. About 10–15 taps plus typing 8–12 category names, and a detour to Google Sheets.
Hesitation points: the meaningless id fields, "why do I need my own spreadsheet first?", and
an empty category list on the first expense.
**Verdict: painful** (it happens only once, but it is where a new user gives up).

### Logging a purchase (form)
Steps: the date is prefilled and the user is preselected. Tap Amount, type it, open the
Category select, scroll and pick one, optionally add a comment, tap **Add Expense**. That is
5–6 taps and about 8–12 s. The form keeps the date and user and clears the rest, which is
right. Friction:
- `type="number"` without `inputmode="decimal"`. On some Android keyboards with a Polish,
  Ukrainian or Russian locale, entering a decimal comma is awkward.
- Category is a long dropdown, not a grid of one-tap chips.
- No frequent or recent shortcuts.
- The confirmation goes only to a screen reader (`LiveAnnouncer`). A sighted user sees only
  the toolbar badge, and the row appears only after the send and reload.
**Verdict: ok.**

### Logging by voice
Steps: hold the mic, say "35 на продукты, отними 10 на хозтовары", release. One gesture and
about 5 s, the best entry path in the app. Gemini knows the category list, splits a total
into parts, and understands "вчера" (yesterday). Friction:
- There is no review step. Every recognised item goes straight into the outbox, so a misheard
  amount or category lands in the sheet, and the only fix is an online swipe-delete.
- Offline, recognition fails with a toast and the clip is effectively lost (there is no queue
  for recognition, and retries are disabled).
- Currency words are deliberately ignored, so 100 грн and 100 zł are summed as the same money.
**Verdict: good when online, risky for accuracy.**

### Fixing a mistake
Steps: find the row in today's list and swipe it right past 100 px. There is no confirmation
and no undo. There is **no edit**: fixing a wrong amount means delete and retype. Delete
needs a network connection, works only on the newest 100 rows (known issue #2), and is
positional (#3). A queued, unsent expense cannot be seen, so it cannot be fixed or discarded,
except as a "failed" record.
**Verdict: painful.**

### "How much did I spend this month / on food?"
Steps: avatar menu, **Statistics** (disabled offline), wait for the month to load, read
per-category sums. Tapping a category drills into its rows. That is 3 taps and a network
wait. Friction:
- Categories are listed in data order, not by size.
- There is no share of the total, no comparison with last month, no daily average and no
  month-end projection.
- The total mixes "debt" rows into spending.
- The dashboard itself shows no sum at all, not even for today.
- There is no combined household view (one person per tab).
**Verdict: ok for "how much", poor for "is that a lot?"**

### Offline at the shop
Steps: the app opens from the service worker, the form works, and **Add** queues to
IndexedDB. Good. But the list does not show the new entry, the confirmation is invisible, and
the badge is the only clue, so double-logging is likely. Statistics and Categories are
blocked. Voice recognition fails. Delete fails.
**Verdict: ok for the form, poor for voice.**

### End-of-month review
Steps: Statistics, select the month, scan the categories, drill into the biggest one. There
is nothing to compare against (no previous month, no limits, no trend), and no way to spot
recurring charges or small frequent purchases except opening the spreadsheet and building a
pivot table. Many users of this app will do exactly that, and that is fine, but the app adds
nothing here.
**Verdict: painful** (the app stops at "here are your sums").

## Ideas

### 1. Show queued expenses in the list immediately, with offline discard
- **Problem for the user:** At the till with poor signal, I log a coffee and nothing appears
  in the list. Did it work? I enter it again, and now it is counted twice. The same happens
  after a voice note: the recognised items stay invisible until they are sent and the day
  reloads, so I cannot see what Gemini actually understood.
- **Idea:** Merge pending outbox records for the current person and day into the dashboard
  table as greyed rows with a small cloud icon ("not sent yet"). Swiping a pending row
  discards it from the outbox, and that works offline. When the record is sent, the
  grey row turns into the real one.
- **Why it saves money / effort:** Duplicate and phantom entries make every total wrong, and
  research on tracking apps links the benefit of tracking to *accurate, consistent* records
  (UW-Madison work on expense tracking as self-regulation, see Sources). Seeing an entry at
  once is also the feedback loop that keeps the logging habit going.
- **Fits the design?** Yes. The outbox already holds `records` as a signal, and the dashboard
  list is a signal. This is a client-side merge plus "discard pending" in the outbox. No sheet
  change.
- **Value:** high · **Effort:** S
- **Type:** tracking-friction

### 2. Dates you can trust
- **Problem for the user:** The form's date and time are fixed when the dashboard opens and
  kept after every submit. An installed PWA can stay open in the background for days, so the
  morning coffee is recorded on *yesterday's* date and with yesterday's time. Separately, the
  date picker's minimum is 1 January of the current year, so on 2 January I cannot log the
  New Year's Eve receipt.
- **Idea:** If the user did not touch the date, stamp the current time at submit. When the
  app becomes visible again on a new day, move the form date and the table to today. Allow
  dates in the previous year (for example, the last 60 days, or no lower bound). Add a
  one-tap "Yesterday" chip next to the date, since yesterday is the most common back-dated
  entry.
- **Why it saves money / effort:** Wrong-day entries corrupt daily and monthly totals without
  anyone noticing. Statistics and any future budget or forecast are only as good as the
  dates.
- **Fits the design?** Yes. It affects the dashboard form only. No sheet change.
- **Value:** high · **Effort:** S
- **Type:** data-quality

### 3. "Today / This month" running total on the dashboard
- **Problem for the user:** After logging, I have no idea where I stand. The only number
  anywhere is on the Statistics page, three taps and a network round-trip away.
- **Idea:** Add a single line under the Add button: "Today: 47.30 · October so far:
  1 240.50 (day 25 of 31)". The today figure is the sum of the visible table (including
  pending rows from #1). The month figure comes from one month-to-date query when the
  dashboard opens, and is updated locally on each add.
- **Why it saves money / effort:** Feedback at the moment of spending is what makes tracking
  change behaviour. The cited app-data study finds that persistent tracking is linked to lower
  discretionary spending, and that people revise their budgets after seeing their spending
  figures. This is also the base that #8 (limits) and #6 (forecast) build on.
- **Fits the design?** With small changes. The today figure is free. The month figure needs a
  second, independent read (the expense list is a single shared signal, so it needs its own
  holder). It becomes free once the local cache from the backend-less assessment (P1 #5)
  exists.
- **Value:** high · **Effort:** S (today) / M (month)
- **Type:** insight

### 4. Review a voice result before it is filed, with Undo
- **Problem for the user:** Gemini sometimes mishears ("пятнадцать" becomes 50) or picks the
  neighbouring category. Today that goes straight to the sheet, and fixing it needs a
  network connection and a swipe-delete.
- **Idea:** After recognition, show a snackbar or card listing the items, for example
  "Продукты 18 · Хозтовары 10 · Сладости 7 — **Undo** / **Edit**". The items wait in the
  outbox as "held" for about 8 seconds and are then released to send. Undo discards them.
  Edit loads a single item into the form.
- **Why it saves money / effort:** It keeps voice, the fastest entry path, from lowering data
  quality. Trusting the numbers is a precondition for acting on them.
- **Fits the design?** Yes. It touches the voice flow on the dashboard and needs a short
  "hold before drain" on outbox records. No sheet or prompt change. Pairs naturally with #1.
- **Value:** high · **Effort:** S–M
- **Type:** data-quality

### 5. Statistics that answer "is that a lot?"
- **Problem for the user:** The month view lists categories in whatever order the data
  arrived, with bare sums. I cannot see at a glance where most of the money goes, or whether
  this month is worse than the last one.
- **Idea:** On the existing Statistics table:
  - sort categories by amount, largest first;
  - add each category's share of the total ("Food 1 240 · 38 %");
  - add a delta against the previous month ("+210 ↑");
  - show debt rows separately from spending (or exclude them, see open questions).
- **Why it saves money / effort:** The Pareto view, "two or three categories are most of the
  money", tells the user where cutting is worth the effort. Comparing with last month is the
  simplest anomaly detector there is.
- **Fits the design?** Yes. Sorting and percentages are pure client-side aggregation. The
  delta needs one extra month query per view (or the local cache). No sheet change.
- **Value:** high · **Effort:** S (sort, %) / M (delta)
- **Type:** insight

### 6. Daily burn rate and month-end forecast
- **Problem for the user:** On the 12th, I don't know whether I am on track. By the time the
  month total looks bad, the money is gone.
- **Idea:** Under the month total in Statistics (and on the dashboard line from #3), show
  "Avg 52/day → about 1 610 by 31 Oct", and, once #8 exists, "safe to spend: 38/day for the
  remaining 19 days".
- **Why it saves money / effort:** A per-day allowance turns an abstract monthly figure into
  a decision you can make at the till. Monefy and similar trackers build their main screen
  around the current balance for this reason.
- **Fits the design?** Yes. It is arithmetic on data already loaded for the current month.
- **Value:** medium–high · **Effort:** S
- **Type:** insight

### 7. One-tap repeats of frequent purchases
- **Problem for the user:** Most entries repeat: the same coffee, the same bus ticket, the
  same lunch. Each one is 5–6 taps of retyping.
- **Idea:** Above the Amount field, show a row of 4–6 chips built from the most frequent
  (category, amount, comment) combinations, for example "☕ Coffee 12", "🚌 Bus 4.40".
  Tapping a chip fills the form, so one more tap adds the expense. A long-press could add it
  immediately.
- **Why it saves money / effort:** Less friction per entry keeps people logging, and
  quitting is the main failure mode of manual tracking. Monefy's appeal is that adding is
  "amount plus tap a category icon".
- **Fits the design?** Yes. The frequency table can be kept in localStorage from this
  device's adds (and later the local cache). No sheet change.
- **Value:** medium–high · **Effort:** S–M
- **Type:** tracking-friction

### 8. Monthly limit per category
- **Problem for the user:** I see after the fact that I spent 1 400 on eating out. Nothing
  warned me while it was happening.
- **Idea:** On the Categories page, add an optional monthly limit next to each name. When a
  category is picked in the form, show a hint under it: "Eating out: 820 of 1 000 · 6 days
  left". When this purchase would push the category past 80 % or 100 % of its limit, colour
  the hint amber or red before **Add** is tapped. Statistics shows progress bars against the
  limits.
- **Why it saves money / effort:** Per-category spending caps are the lightweight version of
  envelope budgeting. They give a limit at the point of decision without demanding a full
  zero-based budget. The UW-Madison app-data study links tracking to better budget
  attainment. YNAB's model rests on giving money a job ahead of time, and a cap is its
  minimal form.
- **Fits the design?** With changes. Store the limit in a new **column C of the `categories`
  tab**. This is additive, and existing `data_*` tabs are untouched, but the category read
  widens to A:C, and existing categories tabs were created with only 2 columns, so setup
  needs an upgrade step. That makes it the natural first user of the schema-version marker
  (assessment P1 #7). Month-to-date per category comes from #3.
- **Value:** high · **Effort:** M
- **Type:** budgeting

### 9. "Small leaks" view in the category drill-down
- **Problem for the user:** 12 coffees a month don't feel like money. 12 × 14 = 168 a month,
  over 2 000 a year, does.
- **Idea:** When drilling into a category, group the rows by comment and show "Coffee ×12 ·
  avg 14 · 168 this month · ≈2 000/yr", sorted by count. The month view can also highlight
  the top 3 frequent small purchases ("under 30, 5 or more times").
- **Why it saves money / effort:** This is "latte factor" analysis. The annualised figure is
  the reframing that makes small habits visible, and it is the user's own data, not a lecture.
- **Fits the design?** Yes. It is client-side grouping of the month that Statistics already
  loads. Its quality depends on consistent comments, which voice input and #7 chips naturally
  produce.
- **Value:** medium · **Effort:** S
- **Type:** insight

### 10. Easy amount entry (decimal keyboard and simple sums)
- **Problem for the user:** On a phone with a comma-decimal locale (pl, uk, ru) a `number`
  field can refuse "4,40". At a market I want to type "12+7.5" for two items.
- **Idea:** Use a decimal keypad (`inputmode="decimal"`), accept both "," and ".", and
  evaluate a simple "a+b" sum when the field loses focus. Also show the user's currency
  symbol as a suffix.
- **Why it saves money / effort:** Removes a failed-entry moment at the till, the exact
  friction that makes people stop logging.
- **Fits the design?** Yes. Form only.
- **Value:** medium · **Effort:** S
- **Type:** tracking-friction

### 11. Don't lose voice notes offline
- **Problem for the user:** In a basement shop with no signal, I hold the mic, speak, and get
  an error. The note is gone, and voice is exactly the path I use when my hands are full.
- **Idea:** When recognition cannot run (offline or a transient error), save the clip itself
  as a pending "to recognise" item in the outbox (IndexedDB stores Blobs). Show it as a
  pending row ("🎤 voice note, 6 s"). Recognise it and queue the results when the connection
  is back, through the review step from #4.
- **Why it saves money / effort:** It makes the fastest path work in the situation where it
  is needed most. Every lost entry is a hole in the month's picture.
- **Fits the design?** With changes. It adds a second outbox record kind (the outbox now
  knows only `addExpense`). Recognition still runs only while the app is open. The Gemini
  call is unchanged.
- **Value:** medium–high · **Effort:** M
- **Type:** tracking-friction

### 12. Easier first run: create the spreadsheet and seed starter categories
- **Problem for the user:** A new user has to create a blank Google spreadsheet elsewhere,
  pick it, then type every category by hand before the first expense.
- **Idea:** On Setup, offer **Create a new spreadsheet for me** next to **Choose existing**.
  Under `drive.file` the app may access files it creates. Offer a starter category set to
  accept or edit: Groceries, Eating out, Transport, Home, Health, Clothes, Entertainment,
  Subscriptions, Gifts, Other. Hide the raw id fields behind "details".
- **Why it saves money / effort:** Every extra step before the first logged expense loses
  users. A good default category set also makes Gemini's mapping more reliable.
- **Fits the design?** Yes. It affects the setup flow, uses an additional Sheets
  `spreadsheets.create` call that `drive.file` allows, and writes categories as today.
- **Value:** medium · **Effort:** S–M
- **Type:** tracking-friction

### 13. Debt ledger: see and settle what is owed
- **Problem for the user:** The "Debt" flag records that something was bought on credit or
  is owed. In the app, though, there is no total of what is outstanding and no way to mark it
  repaid, and in Statistics debt rows are silently mixed into spending.
- **Idea:**
  - Add a "Debts" figure in Statistics: the sum of flagged rows, kept separate from the month
    total.
  - Later, add a "Settle" action that clears the flag on the row (column E) and optionally
    logs the repayment.
- **Why it saves money / effort:** Shared and owed money that is not tracked is how small
  loans quietly turn into gifts. Showing it separately also keeps the spending totals honest.
- **Fits the design?** Partly. Showing the total is client-side (S). "Settle" edits a single
  cell of an existing row, so it needs stable row identity: the id column, assessment P0 #1.
  Positional editing is exactly known issues #2 and #3.
- **Value:** medium · **Effort:** S (show) / M (settle, after the id column)
- **Type:** data-quality

### 14. Edit an expense
- **Problem for the user:** A typo in the amount means delete plus retype, online only, and
  only for the newest 100 rows.
- **Idea:** Tapping a row opens it in the form prefilled, with an **Update** button.
- **Why it saves money / effort:** Cheap correction keeps the data honest. Users who can't fix
  mistakes stop trusting the totals.
- **Fits the design?** Only after the id column (assessment P0 #1; it also removes #2 and #3).
  Updating a row would be a new outbox operation keyed by id.
- **Value:** high · **Effort:** M (after P0 #1)
- **Type:** data-quality

### 15. Recurring expenses and subscription spotting
- **Problem for the user:** Rent, phone and streaming hit every month. Either I log them by
  hand each time, or they never appear and my month looks cheaper than it is. Forgotten
  subscriptions are classic silent leaks.
- **Idea:**
  - **(a) Spotting:** In Statistics, list "looks recurring" items: the same comment and
    similar amount in 3 consecutive months, with the yearly total ("Netflix ≈ 540/yr — still
    using it?").
  - **(b) Due-on-open:** A small `recurring` list (name, amount, category, day of month).
    When the app opens on or after the due day, it offers "Rent 2 500 due — Add?" with one
    tap.
- **Why it saves money / effort:** A subscription audit is one of the most reliable
  low-effort savings, and recurring costs make the forecast in #6 accurate.
- **Fits the design?** With changes. (a) needs 3 months of data: three month queries, or the
  local cache. (b) needs a new tab (additive). There is no background scheduler without a
  server, so "due" is checked when the app opens, which is honest and sufficient.
- **Value:** medium · **Effort:** M (a) / M (b)
- **Type:** habit

### 16. Household view
- **Problem for the user:** The app is built for several people (one `data_<name>` tab
  each), but no screen shows what the family spent in total or per category.
- **Idea:** Add an **All** tab in the Statistics user carousel that sums every person's tab
  for the month, with a per-person breakdown inside each category.
- **Why it saves money / effort:** Shared costs (groceries, kids) are split across people.
  Only the combined view shows the real figure.
- **Fits the design?** Yes, with N month queries (one per tab) or the cache. No sheet change.
- **Value:** medium (high if the household really shares the file, see open questions)
  · **Effort:** M
- **Type:** insight

### 17. Receipt photo to split expenses
- **Problem for the user:** A supermarket receipt mixes groceries, household items and
  sweets. Splitting it by voice is tedious.
- **Idea:** A camera button next to the mic. Gemini reads the photo and returns items grouped
  into the user's categories, shown in the #4 review card. The photo itself is not stored.
- **Why it saves money / effort:** Category accuracy for the largest, most mixed purchases.
  Most of the spending insight in groceries hides inside one receipt.
- **Fits the design?** Yes. Same Gemini service and structured output, with an image part
  instead of audio, and a new prompt. Storing images would need Drive files, so this idea
  leaves them out.
- **Value:** medium · **Effort:** M
- **Type:** tracking-friction

### 18. Currency awareness in voice
- **Problem for the user:** The prompt tells Gemini to ignore the currency word, so "100
  гривен" said during a trip is added as 100 zł (or whatever the home currency is).
- **Idea:** When a spoken currency differs from the user's home currency, keep the original
  in the comment ("100 UAH") and flag the item in the #4 review card so the user can enter
  the converted amount.
- **Why it saves money / effort:** It prevents silent order-of-magnitude errors in totals.
- **Fits the design?** Yes. It changes the Gemini prompt and needs a home-currency setting
  (localStorage). No conversion and no rates API.
- **Value:** low–medium (depends on the owner's answer) · **Effort:** S
- **Type:** data-quality

### 19. Home-screen shortcuts
- **Problem for the user:** Logging starts with opening the app and waiting for the
  dashboard.
- **Idea:** Add manifest `shortcuts` for "Add expense" and "Voice expense". On Android these
  appear on a long-press of the icon. The voice shortcut focuses the mic button.
- **Why it saves money / effort:** Each second removed from the logging path helps the habit
  stick.
- **Fits the design?** Yes. It changes the web manifest and a route parameter. iOS support
  is limited.
- **Value:** low–medium · **Effort:** S
- **Type:** tracking-friction

## Quick wins

These are S effort; each could ship in about a day.

- #1: pending outbox rows in the dashboard list, with offline discard.
- #2: fresh timestamp at submit, roll to today on resume, previous-year dates, "Yesterday"
  chip.
- #3 (today part): today's total under the form.
- #5 (sort and % part): sort categories by amount and show each one's share.
- #6: daily average and month-end forecast in Statistics.
- #9: group drill-down rows by comment, with the yearly projection.
- #10: decimal keypad, comma decimals, "a+b".
- #13 (show part): debts total kept separate from spending.
- #18: keep foreign currency in the comment.
- #19: manifest shortcuts.

## Not recommended

- **Bank or card sync:** it needs a server, aggregator contracts and stored bank credentials,
  which breaks the backend-less design.
- **Push reminders ("you haven't logged today"):** Web Push needs a server to send. Local
  scheduled notifications are not available on iOS PWAs. Use in-app nudges when the app opens
  instead (as in #15b).
- **Full zero-based or envelope budgeting with income allocation:** it needs income and
  account tracking and turns the app into YNAB. Per-category caps (#8) deliver most of the
  benefit for a fraction of the cost.
- **Live multi-currency conversion:** it needs a rates API and a new amount column in every
  `data_*` tab, a breaking layout change. Flag the currency (#18) instead.
- **In-app export or CSV:** the Google Sheet already is the export.
- **Storing receipt images:** it needs Drive file management and storage. Recognise the
  receipt and throw the photo away (#17).
- **In-app category rename:** expenses store the category *name*, so a rename orphans history
  unless it rewrites every `data_*` tab. Do it in the sheet with find-and-replace if needed.
- **Savings goals and net-worth accounts:** they need balances the app never sees. They fit
  the spreadsheet better than this logging tool.

## Open questions for the owner

1. **Who uses it?** Only you, or a household that really shares one spreadsheet? If it is
   shared, #16 (household view) moves up and per-person limits in #8 matter.
2. **What does "Debt" mean in practice?** Bought on credit or owing someone (still my
   spending), or money I lent (not my spending)? The answer decides whether #5 and #13
   exclude debt rows from totals or only label them.
3. **One currency or several?** If trips or two-country life are common, #18 rises. If
   everything is in zł, drop it.
4. **Do you analyse in the Sheet anyway?** If pivot tables in Sheets are your review tool,
   insight ideas (#5, #6, #9, #15a) are worth less, and friction and accuracy ideas (#1, #2,
   #4, #7) are worth more.
5. **Are monthly limits wanted at all**, and per category or only a total? This sets whether
   #8 is a categories-tab column or a single setting.
6. **Will the id column (assessment P0 #1) be done soon?** It unlocks edit (#14) and settle
   (#13), and makes discarding and deduplicating outbox entries safer.
7. **Will the local cache (assessment P1 #5) land?** If yes, build #3 (month part), #5
   (delta), #15a and #16 on it instead of on extra per-view queries.

## Sources

- [UW-Madison dissertation on expense tracking and self-regulation](https://asset.library.wisc.edu/1711.dl/63XZYPDLKMY638S/R/file-908a3.pdf): persistent tracking is linked to lower discretionary spending and better budget attainment, and users revise budgets after seeing their spending data.
- [Monefy, quick-entry flow (The Edge Markets)](https://www.theedgemarkets.com/article/back-basics-expense-tracking) and [Monefy showcase](https://screensdesign.com/showcase/monefy-money-tracker): amount plus one category tap, with the balance updating immediately.
- [YNAB, "What is a sinking fund"](https://www.ynab.com/what-is-a-sinking-fund/): Rule 2, "embrace your true expenses", turns large irregular costs into monthly amounts.
