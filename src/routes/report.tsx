import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/fx/AppShell";
import { DISCLAIMER, EmptyState } from "@/components/fx/bits";
import { useAppState, useFxData } from "@/lib/app-state";
import { generateReport } from "@/lib/fx.functions";
import { summarize, toCsv, strengthLabel } from "@/lib/stats";
import { computeValidation } from "@/lib/validation";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report · FX Sentiment Lab" },
      { name: "description", content: "Auto-generated plain-English insights report for a currency pair." },
      { property: "og:title", content: "Report · FX Sentiment Lab" },
      { property: "og:description", content: "Auto-generated plain-English insights report for a currency pair." },
    ],
  }),
  component: Report,
});

const LAG = 1;

function templateReport(pair: string, s: Record<string, number | string | null>) {
  const r = s.correlation as number | null;
  return `## Key findings
- ${s.headlines_analyzed} headlines analyzed for ${pair}: ${s.bullish} bullish, ${s.bearish} bearish, ${s.neutral} neutral.
- Average sentiment score: ${s.avg_sentiment ?? "n/a"}.

## Sentiment trend
- First-half average ${s.first_half_avg ?? "n/a"}, second-half average ${s.second_half_avg ?? "n/a"}.

## Validation result
- Next-day correlation: ${r == null ? "not computable" : `${r} (${strengthLabel(r).toLowerCase()})`} across ${s.sample_days} days.
- Hit rate: ${s.hit_rate_pct ?? "n/a"}%.
- ${s.interpretation}

## Limitations
- Headline-only analysis; daily reference rates rather than exact closes.
- Small samples make results unreliable. Correlation is not causation.`;
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        if (t.startsWith("## ")) return <h2 key={i} className="pt-4 text-lg font-semibold first:pt-0">{t.slice(3)}</h2>;
        if (t.startsWith("# ")) return <h2 key={i} className="pt-4 text-xl font-semibold">{t.slice(2)}</h2>;
        if (/^[-*] /.test(t)) return <p key={i} className="pl-4 before:-ml-4 before:mr-2 before:text-primary before:content-['•']">{t.slice(2).replace(/\*\*/g, "")}</p>;
        return <p key={i}>{t.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

function Report() {
  const { pair, from, to, demo, days } = useAppState();
  const { data, isLoading } = useFxData();
  const gen = useServerFn(generateReport);
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const v = useMemo(() => (data ? computeValidation(data, from, to, LAG) : null), [data, from, to]);
  const stats = useMemo(() => {
    if (!data || !v) return null;
    const s = summarize(data);
    const half = Math.floor(v.daily.length / 2);
    const avg = (rows: typeof v.daily) => {
      const xs = rows.map((r) => r.avgSentiment).filter((x): x is number => x != null);
      return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : null;
    };
    return {
      headlines_analyzed: s.analyzed, bullish: s.bullish, bearish: s.bearish, neutral: s.neutral,
      avg_sentiment: s.avg == null ? null : Number(s.avg.toFixed(3)),
      first_half_avg: avg(v.daily.slice(0, half)), second_half_avg: avg(v.daily.slice(half)),
      correlation: v.r == null ? null : Number(v.r.toFixed(3)),
      approx_p_value: v.p == null ? null : Number(v.p.toFixed(3)),
      hit_rate_pct: v.hit ? Math.round(v.hit.rate * 100) : null,
      sample_days: v.n, small_sample: v.n < 20 ? "yes" : "no",
      interpretation: v.text,
    } as Record<string, number | string | null>;
  }, [data, v]);

  async function run() {
    if (!stats) return;
    if (demo) {
      setText(templateReport(pair, stats));
      setNote("Demo mode: report written from a template using the computed numbers.");
      return;
    }
    setBusy(true);
    const res = await gen({ data: { pair, from, to, lag: LAG, stats } });
    setBusy(false);
    if (res.ok) { setText(res.data.text); setNote(`Written by ${res.data.model} from the numbers below only.`); }
    else { toast.error(res.error); setText(templateReport(pair, stats)); setNote(`AI summary unavailable (${res.error}) — showing template report.`); }
  }

  useEffect(() => { setText(null); }, [pair, days, demo]);
  useEffect(() => { if (stats && text == null && !busy) run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [stats, text]);

  function downloadCsv() {
    if (!v || !data) return;
    const rows = v.daily.map((d) => ({
      date: d.date, avg_sentiment: d.avgSentiment?.toFixed(4) ?? "", headlines: d.count,
      bullish: d.bullish, bearish: d.bearish, neutral: d.neutral, close: d.close ?? "",
      next_day_change_pct: v.points.find((p) => p.date === d.date)?.change.toFixed(4) ?? "",
    }));
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fx-sentiment-${pair.replace("/", "")}-${from}_${to}.csv`;
    a.click();
  }

  return (
    <>
      <PageTitle title={`${pair} insights report`} subtitle={`${from} → ${to} · validation lag: next day`} action={
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={run} disabled={busy || !stats}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Regenerate</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</Button>
          <Button size="sm" onClick={downloadCsv} disabled={!v}><Download className="h-4 w-4" />Download CSV</Button>
        </div>
      } />
      <article className="card-surface print-plain p-6 sm:p-8">
        {isLoading || busy || (stats && !text) ? (
          <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}</div>
        ) : !stats || !stats.headlines_analyzed ? (
          <EmptyState title="No headlines yet. Click Refresh data" body="Or enable Demo data to see a sample report." />
        ) : (
          <>
            <Markdown text={text ?? ""} />
            <div className="mt-8 grid grid-cols-2 gap-3 border-t pt-5 text-xs sm:grid-cols-4">
              {Object.entries(stats).filter(([k]) => k !== "interpretation").map(([k, val]) => (
                <div key={k}><div className="text-muted-foreground">{k.replaceAll("_", " ")}</div><div className="font-semibold tabular">{val ?? "—"}</div></div>
              ))}
            </div>
            {note && <p className="mt-5 text-xs text-muted-foreground">{note}</p>}
            <p className="mt-2 text-xs font-medium">{DISCLAIMER}</p>
          </>
        )}
      </article>
    </>
  );
}
