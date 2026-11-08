import { TestBed } from '@angular/core/testing';
import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

import { firstValueFrom } from 'rxjs';

import { Expense, VoiceRecording } from 'src/shared/models';

import { ExpenseRecognitionService, GEMINI_MODEL, RecognizedExpense } from './expense-recognition.service';
import { RECEIPT_ERRORS, RECEIPT_MAX_BYTES, RECEIPT_MIME_TYPES } from './receipt-recognition';

describe('ExpenseRecognitionService', () => {
  let service: ExpenseRecognitionService;
  let generateContent: ReturnType<typeof vi.fn>;

  const CATEGORIES = ['Продукты', 'Вкусняшки'];
  const NOW = new Date(2026, 8, 24, 18, 30, 5);
  const recording: VoiceRecording = {
    blob: new Blob(['abc'], { type: 'audio/webm;codecs=opus' }),
    mimeType: 'audio/webm;codecs=opus',
    durationMs: 3000,
    recordedAt: NOW,
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
    replyExpenses([{ amount: 1, category: 'Продукты', comment: null, date: null, isInDebt: false }]);

    await recognize();

    const params = generateContent.mock.calls[0][0] as GenerateContentParameters;
    expect(params.model).toBe(GEMINI_MODEL);
    expect(params.contents).toEqual({
      role: 'user',
      parts: [{ inlineData: { data: btoa('abc'), mimeType: 'audio/webm' } }],
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
      { amount: 5, category: 'Вкусняшки', comment: null, date: null, isInDebt: false },
    ]);

    expect(await recognize()).toEqual([
      { amount: 20, category: 'Продукты', date: NOW },
      { amount: 5, category: 'Вкусняшки', date: NOW },
    ]);
  });

  it('keeps a trimmed comment, the in-debt flag, and a named day with the current time of day', async () => {
    replyExpenses([{ amount: 12.5, category: 'Продукты', comment: '  хлеб ', date: '2026-09-23', isInDebt: true }]);

    expect(await recognize()).toEqual([
      { amount: 12.5, category: 'Продукты', comment: 'хлеб', isInDebt: true, date: new Date(2026, 8, 23, 18, 30, 5) },
    ]);
  });

  it('drops items with a non-positive amount or an unknown category', async () => {
    replyExpenses([
      { amount: 0, category: 'Продукты', comment: null, date: null, isInDebt: false },
      { amount: 3, category: 'Такси', comment: null, date: null, isInDebt: false },
      { amount: 7, category: 'Вкусняшки', comment: null, date: null, isInDebt: false },
    ]);

    expect(await recognize()).toEqual([{ amount: 7, category: 'Вкусняшки', date: NOW }]);
  });

  it('errors when no item survives the filtering', async () => {
    replyExpenses([{ amount: 0, category: 'Продукты', comment: null, date: null, isInDebt: false }]);

    await expect(recognize()).rejects.toThrow(/no valid expenses/);
  });

  it('errors when the reply has an empty "expenses" array', async () => {
    replyExpenses([]);

    await expect(recognize()).rejects.toThrow(/no valid expenses/);
  });

  it('errors with the finish reason when the reply carries no text', async () => {
    reply({ text: undefined, candidates: [{ finishReason: 'SAFETY' } as never] });

    await expect(recognize()).rejects.toThrow(/SAFETY/);
  });

  it('errors when the reply has no "expenses" array', async () => {
    reply({ text: '{}' });

    await expect(recognize()).rejects.toThrow(/expenses/);
  });

  describe('receipt photos', () => {
    const photo = new Blob(['receipt'], { type: 'image/jpeg' });
    const validReply = { date: null, expenses: [{ amount: 12, category: CATEGORIES[0], comment: 'bread' }] };
    const readReceipt = (image = photo, categories = CATEGORIES, date = NOW) =>
      firstValueFrom(service.recognizeReceipt(image, categories, date));

    it('sends the image inline with a receipt schema and returns the selected date', async () => {
      reply({ text: JSON.stringify(validReply) });
      expect(await readReceipt()).toEqual([{ amount: 12, category: CATEGORIES[0], comment: 'bread', date: NOW }]);
      const params = generateContent.mock.calls[0][0] as GenerateContentParameters;
      expect(params.model).toBe(GEMINI_MODEL);
      expect(params.contents).toEqual({ role: 'user', parts: [{ inlineData: { data: btoa('receipt'), mimeType: 'image/jpeg' } }] });
      expect(params.config?.responseMimeType).toBe('application/json');
      expect(params.config?.temperature).toBe(0);
      expect(params.config?.responseJsonSchema).toMatchObject({
        required: ['date', 'expenses'],
        additionalProperties: false,
        properties: { expenses: { items: { properties: { category: { enum: CATEGORIES } } } } },
      });
      expect(params.config?.systemInstruction).toContain('discounts');
      expect(params.config?.systemInstruction).toContain('tax');
      expect(params.config?.systemInstruction).toContain('instructions');
    });

    it.each(RECEIPT_MIME_TYPES)('accepts supported image type %s', async mimeType => {
      reply({ text: JSON.stringify(validReply) });
      await readReceipt(new Blob(['receipt'], { type: mimeType }));
      expect(generateContent).toHaveBeenCalledOnce();
    });

    it.each([
      new Blob(),
      new Blob(['x']),
      new Blob(['x'], { type: 'image/gif' }),
      new Blob([new Uint8Array(RECEIPT_MAX_BYTES + 1)], { type: 'image/png' }),
    ])('rejects unsupported, empty, and oversized photos before calling Gemini', async image => {
      await expect(readReceipt(image)).rejects.toThrow(RECEIPT_ERRORS.photo);
      expect(generateContent).not.toHaveBeenCalled();
    });

    it.each([{ categories: [] }, { categories: [''] }, { categories: ['   '] }])(
      'requires nonempty category names: %j',
      async ({ categories }) => {
        await expect(readReceipt(photo, categories)).rejects.toThrow(RECEIPT_ERRORS.context);
        expect(generateContent).not.toHaveBeenCalled();
      },
    );

    it('rejects an invalid fallback date before calling Gemini', async () => {
      await expect(readReceipt(photo, CATEGORIES, new Date(NaN))).rejects.toThrow(RECEIPT_ERRORS.context);
      expect(generateContent).not.toHaveBeenCalled();
    });

    it.each([undefined, 'private malformed response', '{}', JSON.stringify({ ...validReply, expenses: [] })])(
      'hides malformed response %j',
      async text => {
        reply({ text });
        await expect(readReceipt()).rejects.toThrow(RECEIPT_ERRORS.recognition);
      },
    );

    it('hides SDK errors', async () => {
      generateContent.mockRejectedValue(new Error('private SDK payload'));
      await expect(readReceipt()).rejects.toThrow(RECEIPT_ERRORS.recognition);
    });

    it('does not call Gemini after immediate cancellation', async () => {
      const next = vi.fn();
      const subscription = service.recognizeReceipt(photo, CATEGORIES, NOW).subscribe(next);
      subscription.unsubscribe();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(generateContent).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('aborts an active request and ignores its late result', async () => {
      let resolveResponse!: (response: Partial<GenerateContentResponse>) => void;
      generateContent.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveResponse = resolve;
          }),
      );
      const next = vi.fn();
      const error = vi.fn();
      const subscription = service.recognizeReceipt(photo, CATEGORIES, NOW).subscribe({ next, error });
      await vi.waitFor(() => expect(generateContent).toHaveBeenCalledOnce());
      const signal = (generateContent.mock.calls[0][0] as GenerateContentParameters).config?.abortSignal;
      expect(signal?.aborted).toBe(false);
      subscription.unsubscribe();
      expect(signal?.aborted).toBe(true);
      resolveResponse({ text: JSON.stringify(validReply) });
      await Promise.resolve();
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});
