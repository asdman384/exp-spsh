import { Injectable } from '@angular/core';
import type { Content, GoogleGenAI } from '@google/genai';

import { Observable, defer } from 'rxjs';

import { Expense, VoiceRecording } from 'src/shared/models';

import keys from '../../../keys.json';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** One expense as Gemini returns it, before it becomes an `Expense`. */
export interface RecognizedExpense {
  amount: number;
  category: string;
  comment: string | null;
  date: string | null;
  isInDebt: boolean;
}

/**
 * Turns a spoken `VoiceRecording` into `Expense` objects with Gemini (`@google/genai`), using
 * structured output (`responseJsonSchema`) so the reply is JSON of a known shape.
 *
 * Authenticates with `keys.API_KEY` only. The SDK calls the API with `fetch`, not `HttpClient`,
 * so `ExpAuthInterceptor` never adds its `drive.file` Bearer token. The SDK is loaded with a
 * dynamic `import()` on first use: this service is exported from the `src/services` barrel,
 * which the initial bundle imports, and a static import would put the whole SDK there.
 */
@Injectable({ providedIn: 'root' })
export class ExpenseRecognitionService {
  private client: Promise<GoogleGenAI> | undefined;

  /**
   * @param recording the voice note to recognize
   * @param categories the category names the result may use; the model can pick no other
   * @param now what "today" means for relative days ("вчера"), and the time of day every
   *   returned expense gets
   * @returns the recognized expenses, never empty; errors when Gemini fails, replies with
   *   something other than the requested JSON, or yields no valid expense
   */
  recognize(recording: VoiceRecording, categories: ReadonlyArray<string>, now: Date): Observable<Array<Expense>> {
    return defer(async () => {
      const ai = await this.getClient();
      const contents: Content = {
        role: 'user',
        parts: [{ inlineData: { data: await toBase64(recording.blob), mimeType: baseMimeType(recording.mimeType) } }]
      };
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt(categories, now),
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema(categories)
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error(`Gemini returned no text (finishReason: ${response.candidates?.[0]?.finishReason ?? 'none'})`);
      }
      const parsed = JSON.parse(text) as { expenses?: unknown };
      if (!Array.isArray(parsed.expenses)) {
        throw new Error('Gemini reply has no "expenses" array');
      }
      const result = (parsed.expenses as Array<RecognizedExpense>).flatMap((item) => toExpense(item, categories, now));

      if (!result.length) {
        throw new Error(`Gemini returned no valid expenses: ${text})`);
      }

      return result;
    });
  }

  private getClient(): Promise<GoogleGenAI> {
    this.client ??= import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: keys.GGG_KEY }));
    return this.client;
  }
}

function systemPrompt(categories: ReadonlyArray<string>, now: Date): string {
  return [
    'You extract expenses from a short voice note, usually in Russian, Ukrainian, Polish or English.',
    `Today is ${isoDate(now)}.`,
    `Allowed categories: ${categories.map((c) => JSON.stringify(c)).join(', ')}.`,
    'Rules:',
    '- Return one item per expense. Map each spoken category to the closest allowed category.',
    '- "amount" is a positive number; ignore the currency word (zloty, zł, PLN, грн, etc.).',
    '- When the speaker names a total X for category A and then carves parts out of it',
    '  ("из них", "отними", "вычесть", "минус", "ещё отними"), every part Y1, Y2, ... becomes its own item,',
    '  and A gets what is left: X minus the sum of ALL parts. Subtractions accumulate — each one comes',
    '  out of the same remainder, never out of the original X again. The items must add up to exactly X.',
    '  Example: "запиши 35 на продукты, отними 10 на хозтовары и ещё отними 7 на сладости" →',
    '  продукты 18, хозтовары 10, сладости 7 (18 + 10 + 7 = 35). Wrong: продукты 25 (that ignores the 7).',
    '  If a part has no category of its own, give it category A as well.',
    '- "date" is YYYY-MM-DD only when the speaker names a day ("вчера", "в понедельник"), otherwise null.',
    '- "isInDebt" is true only when the speaker says it was bought on credit or is owed ("в долг").',
    '- "comment" holds any extra detail that is not the amount, category or date, otherwise null.',
    '- If the note describes no expense, return an empty "expenses" array.'
  ].join('\n');
}

function responseSchema(categories: ReadonlyArray<string>): object {
  return {
    type: 'object',
    properties: {
      expenses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            amount: { type: 'number', minimum: 0 },
            // An empty enum is invalid, so an empty category list leaves the field free-form.
            category: categories.length ? { type: 'string', enum: [...categories] } : { type: 'string' },
            comment: { type: ['string', 'null'] },
            date: { type: ['string', 'null'], format: 'date' },
            isInDebt: { type: 'boolean' }
          },
          required: ['amount', 'category', 'comment', 'date', 'isInDebt'],
          additionalProperties: false
        }
      }
    },
    required: ['expenses'],
    additionalProperties: false
  };
}

/** Drops items the schema should have ruled out; the model's output is not trusted blindly. */
function toExpense(item: RecognizedExpense, categories: ReadonlyArray<string>, now: Date): Array<Expense> {
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }
  if (categories.length && !categories.includes(item.category)) {
    return [];
  }

  const expense: Expense = { amount, category: item.category, date: toDate(item.date, now) };
  if (item.comment?.trim()) {
    expense.comment = item.comment.trim();
  }
  if (item.isInDebt === true) {
    expense.isInDebt = true;
  }
  return [expense];
}

/** A named day keeps `now`'s time of day, so expenses stay ordered within that day. */
function toDate(value: string | null, now: Date): Date {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const date = new Date(now);
  if (match) {
    date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return date;
}

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `MediaRecorder` reports e.g. `audio/webm;codecs=opus`; Gemini expects the bare type. */
function baseMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim() || 'audio/webm';
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
