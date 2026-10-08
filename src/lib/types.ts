export type Label = "bullish" | "bearish" | "neutral";

export type HeadlineRow = {
  id: string;
  pair: string;
  title: string;
  description: string | null;
  source: string | null;
  url: string;
  published_at: string;
  sentiment: {
    label: Label;
    score: number;
    confidence: number;
    relevance: number;
    reasoning: string | null;
    model: string;
  } | null;
};

export type PriceRow = { pair: string; date: string; close: number };

export type Dataset = { headlines: HeadlineRow[]; prices: PriceRow[] };
