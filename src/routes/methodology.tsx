import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/fx/AppShell";
import { DISCLAIMER } from "@/components/fx/bits";
import { GROQ_MODEL } from "@/lib/pairs";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology · FX Sentiment Lab" },
      { name: "description", content: "Data sources, sentiment classification, statistics and limitations of FX Sentiment Lab." },
      { property: "og:title", content: "Methodology · FX Sentiment Lab" },
      { property: "og:description", content: "How FX Sentiment Lab classifies headlines and validates sentiment against prices." },
    ],
  }),
  component: Methodology,
});

const SECTIONS: { title: string; body: string[] }[] = [
  { title: "Data sources", body: [
    "Headlines come from NewsAPI's “everything” endpoint (English, sorted by publish time) using a keyword query per pair, de-duplicated by URL.",
    "Prices are daily reference rates from the free Frankfurter API, which publishes European Central Bank reference rates on working days.",
  ] },
  { title: "Sentiment classification", body: [
    `Headlines are sent in batches of about 10 to Groq's ${GROQ_MODEL} model. For each headline it returns a label (bullish, bearish, neutral), a score from −1 to 1, a confidence and relevance from 0 to 1, and a one-sentence reason.`,
    "Bullish means the base currency is likely to strengthen against the quote currency (e.g. EUR up vs USD in EUR/USD). The model judges only from headline text. Each headline is classified once and never re-classified.",
  ] },
  { title: "Daily sentiment", body: [
    "Daily sentiment is the relevance-weighted average score of all analyzed headlines published that UTC day. Off-topic headlines therefore count less.",
  ] },
  { title: "Validation statistics", body: [
    "Price change % is the change from one trading day's rate to the next. “Same day” uses the first trading day on or after the news date (weekend news maps to Monday); “next day” and “2 days ahead” shift that forward by trading days.",
    "Pearson correlation (r) measures linear co-movement between daily sentiment and price change. An approximate p-value is shown as a rough guide only.",
    "Hit rate is the share of days where the direction of sentiment matched the direction of the price move, excluding near-neutral days (|score| ≤ 0.05). About 50% is what a coin flip achieves.",
  ] },
  { title: "Limitations", body: [
    "Headline-only analysis misses article context, and language models can misjudge financial nuance.",
    "Daily reference rates are fixed around 14:15 CET, not exact market closes, and miss intraday moves.",
    "Samples of 7–30 days are small; results under 20 days are flagged as unreliable.",
    "Correlation is not causation: news and prices may both react to the same underlying events.",
  ] },
];

function Methodology() {
  return (
    <>
      <PageTitle title="Methodology" subtitle="How the numbers in this app are produced." />
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card-surface p-6">
            <h2 className="text-base font-semibold">{s.title}</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {s.body.map((b) => <p key={b}>{b}</p>)}
            </div>
          </section>
        ))}
        <section className="card-surface flex items-center bg-navy p-6 text-navy-foreground">
          <p className="text-lg font-semibold">{DISCLAIMER}</p>
        </section>
      </div>
    </>
  );
}
