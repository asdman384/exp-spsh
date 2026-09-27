import { TestBed } from '@angular/core/testing';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import { firstValueFrom } from 'rxjs';

import { Expense, VoiceRecording } from 'src/shared/models';

import { ExpenseRecognitionService, GEMINI_MODEL, RecognizedExpense } from './expense-recognition.service';

describe('ExpenseRecognitionService', () => {
  let service: ExpenseRecognitionService;
  let generateContent: ReturnType<typeof vi.fn>;

  const CATEGORIES = ['Продукты', 'Вкусняшки'];
  const NOW = new Date(2026, 8, 24, 18, 30, 5);
  const recording: VoiceRecording = {
    blob: new Blob(['abc'], { type: 'audio/webm;codecs=opus' }),
    mimeType: 'audio/webm;codecs=opus',
    durationMs: 3000,
    recordedAt: NOW
  };

  function reply(response: Partial<GenerateContentResponse>): void {
    generateContent.mockResolvedValue(response as GenerateContentResponse);
  }

  function replyExpenses(expenses: Array<Partial<RecognizedExpense>>): void {
    reply({ text: JSON.stringify({ expenses }) });
  }

  function recognize(): Promise<Array<Expense>> {
    return firstValueFrom(service.recognize(recording, CATEGORIES, NOW));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExpenseRecognitionService);
    // The SDK client is a private, lazily-created field; pre-fill it with a stub so neither the
    // SDK import nor a network request happens in the test.
    generateContent = vi.fn();
    (service as unknown as { client: Promise<unknown> }).client = Promise.resolve({ models: { generateContent } });
  });

  it('sends the audio inline with a JSON response schema limited to the given categories', async () => {
    replyExpenses([]);

    expect(await recognize()).toEqual([]);

    const params = generateContent.mock.calls[0][0] as GenerateContentParameters;
    expect(params.model).toBe(GEMINI_MODEL);
    expect(params.contents).toEqual({
      role: 'user',
      parts: [{ inlineData: { data: btoa('abc'), mimeType: 'audio/webm' } }]
    });
    expect(params.config?.responseMimeType).toBe('application/json');
    const schema = params.config?.responseJsonSchema as {
      properties: { expenses: { items: { properties: { category: { enum: Array<string> } } } } };
    };
    expect(schema.properties.expenses.items.properties.category.enum).toEqual(CATEGORIES);
    expect(params.config?.systemInstruction).toContain('Today is 2026-09-24.');
  });

  it('maps a split ("25, of which 5 on snacks") into two expenses dated now', async () => {
    replyExpenses([
      { amount: 20, category: 'Продукты', comment: null, date: null, isInDebt: false },
      { amount: 5, category: 'Вкусняшки', comment: null, date: null, isInDebt: false }
    ]);

    expect(await recognize()).toEqual([
      { amount: 20, category: 'Продукты', date: NOW },
      { amount: 5, category: 'Вкусняшки', date: NOW }
    ]);
  });

  it('keeps a trimmed comment, the in-debt flag, and a named day with the current time of day', async () => {
    replyExpenses([{ amount: 12.5, category: 'Продукты', comment: '  хлеб ', date: '2026-09-23', isInDebt: true }]);

    expect(await recognize()).toEqual([
      { amount: 12.5, category: 'Продукты', comment: 'хлеб', isInDebt: true, date: new Date(2026, 8, 23, 18, 30, 5) }
    ]);
  });

  it('drops items with a non-positive amount or an unknown category', async () => {
    replyExpenses([
      { amount: 0, category: 'Продукты', comment: null, date: null, isInDebt: false },
      { amount: 3, category: 'Такси', comment: null, date: null, isInDebt: false }
    ]);

    expect(await recognize()).toEqual([]);
  });

  it('errors with the finish reason when the reply carries no text', async () => {
    reply({ text: undefined, candidates: [{ finishReason: 'SAFETY' } as never] });

    await expect(recognize()).rejects.toThrow(/SAFETY/);
  });

  it('errors when the reply has no "expenses" array', async () => {
    reply({ text: '{}' });

    await expect(recognize()).rejects.toThrow(/expenses/);
  });
});
