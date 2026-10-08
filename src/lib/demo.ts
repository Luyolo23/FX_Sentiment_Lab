import { PAIRS } from "./pairs";
import { addDays } from "./stats";
import type { Dataset, HeadlineRow, Label } from "./types";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const START: Record<string, number> = {
  "EUR/USD": 1.0912, "GBP/USD": 1.2745, "USD/JPY": 149.3, "AUD/USD": 0.6621, "USD/CAD": 1.3588, "USD/CHF": 0.8842,
};

const TEMPLATES: Record<Label, string[]> = {
  bullish: [
    "{B} gains as {BC} signals further tightening",
    "{B} firms after stronger-than-expected {BCountry} inflation data",
    "{Q} slips as traders price in earlier {QC} rate cuts",
    "Upbeat {BCountry} PMI lifts {B} against {Q}",
    "{QC} officials hint at pause, weighing on {Q}",
  ],
  bearish: [
    "{B} slides as {BC} adopts dovish tone",
    "{Q} rallies on robust {QCountry} jobs report",
    "Weak {BCountry} retail sales drag {B} lower",
    "Safe-haven demand boosts {Q} amid market jitters",
    "{BC} minutes reveal growing concern over growth, {B} dips",
  ],
  neutral: [
    "Markets await {QC} decision; {PAIR} trades in tight range",
    "{PAIR} steady ahead of key data releases",
    "Analysts split on outlook for {B} into quarter-end",
    "Holiday-thinned trading keeps {PAIR} subdued",
  ],
};

const META: Record<string, { bank: string; country: string }> = {
  EUR: { bank: "ECB", country: "eurozone" },
  USD: { bank: "Fed", country: "US" },
  GBP: { bank: "BoE", country: "UK" },
  JPY: { bank: "BoJ", country: "Japan" },
  AUD: { bank: "RBA", country: "Australian" },
  CAD: { bank: "BoC", country: "Canadian" },
  CHF: { bank: "SNB", country: "Swiss" },
};

const SOURCES = ["Reuters", "FXStreet", "Bloomberg", "ForexLive", "MarketWatch", "CNBC", "Financial Times"];

export function buildDemo(pairId: string, from: string, to: string): Dataset {
  const pair = PAIRS.find((p) => p.id === pairId) ?? PAIRS[0];
  const r = rng(pairId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 97);
  const headlines: HeadlineRow[] = [];
  const prices: Dataset["prices"] = [];
  let close = START[pair.id] ?? 1;
  // Pre-roll to one trading day before range so lag-0 changes exist
  let latent = 0;
  for (let d = addDays(from, -3); d <= addDays(to, 0); d = addDays(d, 1)) {
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    latent = 0.6 * latent + (r() - 0.5) * 0.9;
    const inRange = d >= from;
    if (inRange) {
      const n = 3 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const x = latent + (r() - 0.5) * 0.9;
        const label: Label = x > 0.18 ? "bullish" : x < -0.18 ? "bearish" : "neutral";
        const t = TEMPLATES[label][Math.floor(r() * TEMPLATES[label].length)];
        const title = t
          .replaceAll("{B}", pair.base).replaceAll("{Q}", pair.quote).replaceAll("{PAIR}", pair.id)
          .replaceAll("{BC}", META[pair.base].bank).replaceAll("{QC}", META[pair.quote].bank)
          .replaceAll("{BCountry}", META[pair.base].country).replaceAll("{QCountry}", META[pair.quote].country);
        const score = label === "neutral" ? (r() - 0.5) * 0.2 : Math.max(-1, Math.min(1, x * 1.1));
        const hour = 6 + Math.floor(r() * 14);
        headlines.push({
          id: `demo-${pair.id}-${d}-${i}`,
          pair: pair.id,
          title,
          description: null,
          source: SOURCES[Math.floor(r() * SOURCES.length)],
          url: `https://example.com/demo/${encodeURIComponent(title)}`,
          published_at: `${d}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00Z`,
          sentiment: {
            label,
            score: Number(score.toFixed(2)),
            confidence: Number((0.55 + r() * 0.4).toFixed(2)),
            relevance: Number((0.4 + r() * 0.6).toFixed(2)),
            reasoning:
              label === "bullish" ? `Suggests ${pair.base} strength relative to ${pair.quote}.`
              : label === "bearish" ? `Implies ${pair.base} weakness or ${pair.quote} strength.`
              : "No clear directional implication for the pair.",
            model: "demo",
          },
        });
      }
    }
    if (dow !== 0 && dow !== 6) {
      // Price reacts weakly to the latent sentiment plus noise
      close = close * (1 + latent * 0.0018 + (r() - 0.5) * 0.008);
      prices.push({ pair: pair.id, date: d, close: Number(close.toFixed(pair.quote === "JPY" ? 3 : 5)) });
    }
  }
  return { headlines, prices };
}
