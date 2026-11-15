/** Parse decimal amounts and addition only. Never execute user input. */
export function parseAmount(text: string): number | null {
  const terms = text
    .trim()
    .split('+')
    .map(term => term.trim().replace(',', '.'));
  if (!terms.every(term => /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(term))) return null;
  const total = terms.reduce((sum, term) => sum + Number(term), 0);
  // Remove binary floating-point noise, such as 0.1 + 0.2.
  return Number.isFinite(total) ? Number(total.toPrecision(15)) : null;
}
