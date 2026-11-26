# 2026-11-22: Improve Month Summary Readability

**Status:** todo
**Priority:**
**Type:** feature
**Module(s):** Statistics (Month summary)
**Owner:** Oleg
**Created:** 2026-11-22

## Description

On the mobile Month summary screen, each category shows three numbers under a single Amount heading. Make the amount for the selected month easy to find, identify the share and comparison period, and give the spending total a clear place above the table. Use gray text for categories shown only for comparison with the previous month. Let users enter category selection with a long press.

## Functional Requirements

- Set the category amount to font weight 600. Use regular-weight dark gray text for the share and change. Right-align the values within each numeric column.
- Label the columns Category, Amount, Share, and vs followed by the short name of the previous calendar month. Use the same month name as the month tabs. Show a plus sign for increases, a minus sign for decreases, and a plain zero for no change. Remove the direction arrows.
- Display the comparison heading as plain text. Include all saved entries for the selected month in the calculation, including entries dated later in that month.
- Place a small Spending label above a large spending total. Place Debt and its amount beside Spending with less visual emphasis.
- Use readable, muted gray text for the category name, amount, share, and change when a category has expenses in the previous month and no entries in the selected month. Keep the standard row style for categories with entries in the selected month, including entries that sum to zero.
- Hide the checkbox column by default. A short tap opens category details. A long press on any category enters selection mode and shows the header and row checkboxes, all checked. Releasing the long press keeps the user on the summary with all categories selected. In selection mode, allow individual selection and select-all.
- Keep the selection mode and the checked categories when the user returns from category details to the same summary. Changing the user or the calendar month exits selection mode.

## Non-Functional Requirements

- Keep category selection accessible by keyboard. Use a text contrast ratio of at least 4.5:1 for regular-size gray text against the row background.
- The user performs all browser checks for this task, including visual and interaction checks. The user also owns all end-to-end (E2E) testing. Exclude browser checks and the creation, modification, and execution of E2E tests from the agent's plan and implementation.

## Acceptance Criteria

- [ ] Given Ресторан spending of 460,1 this month and 1 026,2 last month, and total spending of 3 462,63 this month, the row shows **460,1**, 13,3%, and −566,1 under the three numeric headings at 425 px. The amount has weight 600. Share and change have regular weight and dark gray text. Values in each numeric column share a right edge across rows.
- [ ] With English month tabs, selecting November shows vs Oct. Selecting January shows vs Dec and uses December of the previous year. Positive, negative, and zero changes display as +267, −566,1, and 0, respectively, without arrows.
- [ ] With November 22 as the local date and November selected, a saved expense dated November 25 counts toward November spending.
- [ ] With the example totals, Spending appears above the prominent 3 462,63. Debt and 241,67 remain readable beside it at 425 px.
- [ ] At 425 px, Господарські товари is readable without overlapping the numbers or requiring horizontal scrolling. The checkbox column takes no space in the default view.
- [ ] Given spending of 56 in October and no November entries for Медикаменти, the November row shows Медикаменти, 0, 0%, and −56 in readable gray text. A category with November entries that sum to zero keeps the standard text colors.
- [ ] From the default view, a short tap opens details. A long press on either a standard row or a gray row reveals all checkboxes. After release, the summary stays open and every checkbox is checked, including the one on the pressed row.
- [ ] Starting a vertical scroll on a category row lets the user scroll without entering selection mode or opening details.
- [ ] Clearing all checkboxes sets Spending to 0. Checking one category shows its amount as Spending. Selecting all restores the full spending total. Shares and the Debt total keep their original values in all three cases.
- [ ] After clearing one checkbox, open a category and return. The checkboxes are visible, the same category is unchecked, and Spending shows the same subtotal.
- [ ] From a partial selection, change the user or select a different calendar month, including the same month in a different year. In each case, the new summary hides the checkboxes and shows its full Spending total.

## Common sense considerations

- Apply the new columns, styling, and selection gestures to the Month summary category list only. The Dashboard and category detail view keep their existing columns and interactions.
- A category is present if it has at least one entry. This rule also applies when all its entries sum to zero.

## Notes

<!-- Append timestamped notes here as work progresses -->
