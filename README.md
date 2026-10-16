# FX Sentiment Lab

An educational web app that explores whether **news sentiment predicts short-term
forex price moves** — and shows honestly when it doesn't.

It fetches real headlines for a currency pair, classifies each one as bullish,
bearish or neutral for the pair using an LLM, pulls daily reference exchange
rates, and then statistically validates the sentiment against actual price
changes (correlation, hit rate, small-sample checks). A key theme throughout the
app is that **correlation is not causation** and small samples are unreliable.

**Live app**: https://pixel-perfect-canvas-8662.lovable.app

## What it does

- **Dashboard** — sentiment trend and price chart for the selected pair, daily
  bullish/bearish/neutral counts, headline feed with per-headline sentiment,
  score and reasoning.
- **Validation** — Pearson correlation between daily sentiment and price change
  at a chosen lag (0–2 trading days), linear regression, hit rate, rough
  p-value, and a plain-English interpretation with small-sample cautions.
- **Report** — an LLM-written markdown summary generated *only* from the
  computed statistics (no invented facts, no trading advice).
- **Methodology** — documents the scoring model, weighting, lag logic and
  limitations.

Supported pairs: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF.
Date ranges: 7, 14 or 30 days.

## Data sources

| What | Source | Key needed? |
| --- | --- | --- |
| News headlines | [NewsAPI](https://newsapi.org) (`/v2/everything`) | Yes — `NEWS_API_KEY` |
| Daily exchange rates | [Frankfurter](https://frankfurter.dev) (ECB reference rates) | No |
| Sentiment classification & report writing | Groq (`llama-3.3-70b-versatile`) | Yes — `GROQ_API_KEY` |

Headlines, sentiment rows and daily prices are stored in the built-in
**Lovable Cloud** database (tables: `headlines`, `sentiments`, `prices`),
keyed by pair, so refreshing accumulates history instead of replacing it.

**Demo data**: a "Demo data" switch generates a deterministic synthetic dataset
(headlines + prices with a built-in weak sentiment-to-price signal) so every
page can be explored without any API keys.

## Using live data

Refresh runs three steps in order (shown in a dialog):

1. **Fetch news** — headlines for the pair within the selected range (NewsAPI).
2. **Classify sentiment** — batched LLM calls label pending headlines; up to 60
   per call, so run refresh again until "still pending" clears.
3. **Fetch prices** — daily reference rates (Frankfurter, no key needed).

Notes:

- The free NewsAPI plan only covers roughly the **last month** of headlines, so
  the 30-day range is about the realistic maximum.
- Both `NEWS_API_KEY` and `GROQ_API_KEY` are stored as app secrets in Lovable
  (ask in the editor: *"add my keys"*). They are read server-side only and are
  never exposed to the browser.

## Tech stack

- **TanStack Start v1** (React 19, TanStack Router + React Query) on Vite;
  SSR with Tailwind CSS v4 and shadcn-style UI components.
- **Lovable Cloud** (hosted backend) for storage of headlines, sentiments and
  prices.
- Server logic runs in `createServerFn` server functions
  (`src/lib/fx.functions.ts`); all external API calls and the LLM stay
  server-side.
- Sentiment is relevance-weighted per day; validation math (Pearson, OLS,
  approximate p-value) lives in `src/lib/stats.ts` and is covered by tests in
  `src/test/`.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev        # dev server
npm test           # vitest
npm run lint
npm run build
```

Continue developing in the [Lovable editor](https://lovable.dev/projects/91f9c2c3-f9be-48dd-a3bc-bf5dafe37b5f).

## Disclaimer

Educational tool only — not financial advice. Exchange rates are ECB reference
rates (no intraday data), sentiment comes from headlines alone, and the
validation statistics are rough guides, not proof of a tradable edge.
