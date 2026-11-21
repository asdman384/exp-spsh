# 2026-11-19: Six-Month Category Spending Chart

**Status:** implemented
**Priority:** high
**Type:** feature
**Module(s):** Setup, Google Sheets
**Owner:** Oleg
**Created:** 2026-11-19

## Description

> Показать расходы на продукты за полгода в самой Google Таблице
>
> Сейчас из двух соседних месяцев можно узнать, что в октябре на продукты ушло больше, чем в сентябре. Из этого ещё трудно понять, был ли октябрь исключением. Одна линия с шестью месячными суммами отвечает на этот вопрос за один просмотр.

[Original idea, item 1](../../../ideas/2026-11-19-spending-expert.md)

The first version adds one line chart to the family spreadsheet. The owner can select a person and a category to see six monthly totals together.

## Functional Requirements

1. Offer `Overview` as an optional report in Setup for both new and existing spreadsheets. The owner can finish Setup without adding it. On repeat visits, preserve the report and the owner's edits.
2. Provide person and category selectors above the chart. When Setup creates the report, list people with visible personal expense tabs in that spreadsheet, including a tab created during this Setup visit. If a new person joins later, add them to the selector when Setup next runs for that spreadsheet. Take category choices from column A of `categories`. Read purchases only from the selected person's tab.
3. Use a native Google Sheets line chart. Show the last six completed calendar months in date order on the horizontal axis and monthly spending in zł on the vertical axis.
4. Use sheet formulas to sum purchase amounts in column C by category in A and purchase date in D. Include purchases entered by form, voice, or receipt photo. Include new rows inserted at the top. Debt repayment in column E must have no effect on spending.
5. Use the earliest purchase date across all categories on the selected person's tab to determine when their history starts. Leave earlier months blank. From that month onward, show 0 zł for each completed month with no matching purchases. If the person has no purchases, leave all six amounts blank.

## Acceptance Criteria

- [x] **1.** Finish first setup without adding the report. Reopen Setup and add it to the same file. Also add it during first setup of a new file. Each file has one `Overview` tab with one line chart. Edit the chart title and run Setup again. The title and chart count stay the same.
- [x] **2.** Give two people different totals for the same category. Switch the person and check each total against that person's rows. Add a category to the family list, record a purchase in it, and select it above the chart. The chart shows that purchase for the correct person.
- [x] **3.** On 19 November 2026, the chart shows May through October 2026 in order with amounts in zł. On 1 December, it shows June through November.
- [x] **4.** For one category in October, record 10 zł by form, 20 zł by voice, and 120 zł by receipt photo. After all three rows reach Sheets, enter 120 in column E of the receipt row. October shows 150 zł. Clear that cell in November. October still shows 150 zł. Insert another October purchase of 5 zł in row 1. October now shows 155 zł.
- [x] **5.** In the May–October window, select groceries for a person whose first purchase was transport in July, who spent 80 zł on groceries in August, and who made no purchases in September. May and June have no plotted points. July shows 0 zł, August shows 80 zł, and September shows 0 zł. Switch to a person with no purchases and check that all six months have no points.
- [x] **6.** Skip starter categories in a new spreadsheet and add the report. Setup can finish. All six month labels appear with blank amounts. After a family category is added, the owner can select it in the report.
- [x] **7.** Try adding the report to a file with an unrelated tab already named `Overview`. Setup explains the name conflict and preserves the tab's contents. After an interrupted report creation, retrying leaves one complete report.
- [x] **8.** After report creation, add a visible personal expense tab for a new family member and record a purchase in a completed month shown on the chart. Run Setup again for that spreadsheet. Select the new person and the purchase category in the existing report. The chart shows the purchase amount for that month.

[Verification results and browser exclusions](impl-plan.md#verification-on-21-november-2026). Setup was tested in jsdom and spreadsheet behavior was checked in disposable native Google Sheets.

## Common sense considerations

- Use the spreadsheet's calendar month and the purchase date and time in D. Include purchases through the last instant of each completed month.
- Leave the amounts blank until both selectors have a value. A blank amount has no point on the chart.
- Limit report creation to the `Overview` tab. Preserve existing expense and category rows.

## Notes

The source also suggests a separate current-month total, a yearly chart, and a category breakdown. These are possible later additions.
