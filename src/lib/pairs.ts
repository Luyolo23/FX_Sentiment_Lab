export type PairConfig = {
  id: string; // e.g. "EUR/USD"
  base: string;
  quote: string;
  keywords: string;
};

export const PAIRS: PairConfig[] = [
  { id: "EUR/USD", base: "EUR", quote: "USD", keywords: "EUR/USD OR euro OR ECB OR \"Federal Reserve\"" },
  { id: "GBP/USD", base: "GBP", quote: "USD", keywords: "GBP/USD OR sterling OR \"Bank of England\" OR \"Federal Reserve\"" },
  { id: "USD/JPY", base: "USD", quote: "JPY", keywords: "USD/JPY OR yen OR \"Bank of Japan\" OR \"Federal Reserve\"" },
  { id: "AUD/USD", base: "AUD", quote: "USD", keywords: "AUD/USD OR \"Australian dollar\" OR RBA OR \"Reserve Bank of Australia\"" },
  { id: "USD/CAD", base: "USD", quote: "CAD", keywords: "USD/CAD OR \"Canadian dollar\" OR loonie OR \"Bank of Canada\"" },
  { id: "USD/CHF", base: "USD", quote: "CHF", keywords: "USD/CHF OR \"Swiss franc\" OR SNB OR \"Swiss National Bank\"" },
];

export const RANGES = [7, 14, 30] as const;
export type RangeDays = (typeof RANGES)[number];

export const GROQ_MODEL = "llama-3.3-70b-versatile";

export function getPair(id: string): PairConfig | undefined {
  return PAIRS.find((p) => p.id === id);
}
