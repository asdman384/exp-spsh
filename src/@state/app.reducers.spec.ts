import { AppActions } from './app.actions';
import { AppState } from './app.model';
import { initialState, reducers } from './app.reducers';

// [AC5] proves, against the real reducer: initial `lastError` is `null`; one `operationFailed`
// sets `source`/`message`/`id === 1`; a second **identical** `operationFailed` produces a new
// object with `id === 2`; and the branch leaves every other `AppState` key untouched.
describe('[AC5] app reducers - operationFailed / lastError', () => {
  const reducer = reducers.app;

  it('should_have_null_lastError_in_initial_state', () => {
    const state = reducer(undefined, { type: '@@INIT' });

    expect(state.lastError).toBeNull();
  });

  it('should_set_source_message_and_id_1_on_first_operationFailed', () => {
    const start: AppState = { ...initialState, lastError: null };

    const next = reducer(start, AppActions.operationFailed({ source: 'loadCategories$', message: 'Boom' }));

    expect(next.lastError).toEqual({ id: 1, source: 'loadCategories$', message: 'Boom' });
  });

  it('should_produce_new_object_with_id_2_on_second_identical_operationFailed', () => {
    const start: AppState = { ...initialState, lastError: null };
    const action = AppActions.operationFailed({ source: 'loadCategories$', message: 'Boom' });

    const first = reducer(start, action);
    const second = reducer(first, action);

    expect(second.lastError).toEqual({ id: 2, source: 'loadCategories$', message: 'Boom' });
    expect(second.lastError).not.toBe(first.lastError);
  });

  it('should_leave_every_other_AppState_key_untouched', () => {
    const start: AppState = {
      ...initialState,
      loading: true,
      title: 'My title',
      icon: 'star',
      spreadsheetId: 'sheet-abc',
      categoriesSheetId: 7,
      categories: [{ id: 0, name: 'Food' }],
      expenses: [],
      lastError: null
    };

    const next = reducer(start, AppActions.operationFailed({ source: 'addExpense$', message: 'Nope' }));

    expect(next.loading).toBe(start.loading);
    expect(next.title).toBe(start.title);
    expect(next.icon).toBe(start.icon);
    expect(next.spreadsheetId).toBe(start.spreadsheetId);
    expect(next.dataSheets).toBe(start.dataSheets);
    expect(next.categoriesSheetId).toBe(start.categoriesSheetId);
    expect(next.categories).toBe(start.categories);
    expect(next.expenses).toBe(start.expenses);
  });
});
