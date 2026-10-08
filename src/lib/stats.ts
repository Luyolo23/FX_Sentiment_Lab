import type { Dataset, HeadlineRow, Label, PriceRow } from "./types";

export type DailyRow = {
  date: string;
  avgSentiment: number | null;
  count: number;
  bullish: number;
  bearish: number;
  neutral: number;
  close: number | null;
};

export const dayKey = (iso: string) => iso.slice(0, 10);

export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dateRange(days: number, end = new Date()) {
  const to = end.toISOString().slice(0, 10);
  const from = addDays(to, -(days - 1));
  return { from, to };
}

/** Relevance-weighted mean of sentiment scores; falls back to plain mean if all relevance is 0. */
export function weightedScore(items: HeadlineRow[]) {
  const s = items.filter((h) => h.sentiment);
  if (!s.length) return null;
  let w = 0, sum = 0;
  for (const h of s) {
    const wt = h.sentiment!.relevance;
    w += wt;
    sum += h.sentiment!.score * wt;
  }
  if (w === 0) return s.reduce((a, h) => a + h.sentiment!.score, 0) / s.length;
  return sum / w;
}

export function buildDaily(data: Dataset, from: string, to: string): DailyRow[] {
  const byDay = new Map<string, HeadlineRow[]>();
  for (const h of data.headlines) {
    const k = dayKey(h.published_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(h);
  }
  const priceMap = new Map(data.prices.map((p) => [p.date, p.close]));
  const rows: DailyRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const items = byDay.get(d) ?? [];
    const c = (l: Label) => items.filter((h) => h.sentiment?.label === l).length;
    rows.push({
      date: d,
      avgSentiment: weightedScore(items),
      count: items.filter((h) => h.sentiment).length,
      bullish: c("bullish"),
      bearish: c("bearish"),
      neutral: c("neutral"),
      close: priceMap.get(d) ?? null,
    });
  }
  return rows;
}

/**
 * Price change % for sentiment on `date` at a given lag.
 * Lag 0 = change into the first trading day on/after `date`; lag k = k trading days later.
 */
export function priceChangeAt(prices: PriceRow[], date: string, lag: number): number | null {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const i = sorted.findIndex((p) => p.date >= date);
  if (i < 0) return null;
  const t = i + lag;
  if (t < 1 || t >= sorted.length) return null;
  return ((sorted[t].close - sorted[t - 1].close) / sorted[t - 1].close) * 100;
}

export type ValidationPoint = { date: string; sentiment: number; change: number; count: number };

export function buildValidation(daily: DailyRow[], prices: PriceRow[], lag: number): ValidationPoint[] {
  const out: ValidationPoint[] = [];
  for (const d of daily) {
    if (d.avgSentiment == null || d.count === 0) continue;
    const ch = priceChangeAt(prices, d.date, lag);
    if (ch == null) continue;
    out.push({ date: d.date, sentiment: d.avgSentiment, change: ch, count: d.count });
  }
  return out;
}

export function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function linreg(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

/** Two-sided p-value from t-statistic using a normal approximation (adequate as a rough guide). */
export function approxPValue(r: number, n: number) {
  if (n < 4 || Math.abs(r) >= 1) return null;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const z = Math.abs(t);
  // Abramowitz-Stegun erf approximation
  const p = 0.3275911, a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const x = z / Math.SQRT2;
  const k = 1 / (1 + p * x);
  const erf = 1 - (((((a[4] * k + a[3]) * k + a[2]) * k + a[1]) * k + a[0]) * k) * Math.exp(-x * x);
  return 1 - erf;
}

export function hitRate(points: ValidationPoint[]) {
  const usable = points.filter((p) => Math.abs(p.sentiment) > 0.05 && p.change !== 0);
  if (!usable.length) return null;
  const hits = usable.filter((p) => Math.sign(p.sentiment) === Math.sign(p.change)).length;
  return { rate: hits / usable.length, hits, n: usable.length };
}

export function strengthLabel(r: number) {
  const a = Math.abs(r);
  if (a < 0.1) return "No meaningful";
  if (a < 0.3) return "Weak";
  if (a < 0.5) return "Moderate";
  return "Strong";
}

export function interpret(r: number | null, n: number, p: number | null) {
  if (r == null) return "Not enough data to compute a correlation. At least 3 days with both sentiment and price data are needed.";
  const dir = r > 0 ? "positive" : "negative";
  const s = strengthLabel(r);
  const rel =
    p != null && p < 0.05 && n >= 20
      ? "statistically significant at the 5% level (still not proof of causation)"
      : "not statistically reliable with this sample size";
  if (s === "No meaningful") return `No meaningful relationship between sentiment and price moves (r = ${r.toFixed(2)}); ${rel}.`;
  return `${s} ${dir} relationship (r = ${r.toFixed(2)}) between daily sentiment and price change; ${rel}.`;
}

export function summarize(data: Dataset) {
  const s = data.headlines.filter((h) => h.sentiment);
  return {
    total: data.headlines.length,
    analyzed: s.length,
    bullish: s.filter((h) => h.sentiment!.label === "bullish").length,
    bearish: s.filter((h) => h.sentiment!.label === "bearish").length,
    neutral: s.filter((h) => h.sentiment!.label === "neutral").length,
    avg: weightedScore(s),
  };
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
