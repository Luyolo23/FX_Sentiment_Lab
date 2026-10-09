import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/fx/AppShell";
import { EmptyState, ScoreGauge, SectionCard, SentimentBadge, StatCard, fmtScore, scoreTone } from "@/components/fx/bits";
import { useAppState, useFxData } from "@/lib/app-state";
import { addDays, buildDaily, summarize, weightedScore } from "@/lib/stats";
import type { Label } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · FX Sentiment Lab" },
      { name: "description", content: "Daily sentiment of forex news headlines per currency pair, with price overlay." },
      { property: "og:title", content: "Dashboard · FX Sentiment Lab" },
      { property: "og:description", content: "Daily sentiment of forex news headlines per currency pair, with price overlay." },
    ],
  }),
  component: Dashboard,
});

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };
const tipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 };

function Dashboard() {
  const { pair, from, to, days } = useAppState();
  const { data, isLoading, error } = useFxData();
  const [filter, setFilter] = useState<Label | "all">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const daily = useMemo(() => (data ? buildDaily(data, from, to) : []), [data, from, to]);
  const sum = useMemo(() => (data ? summarize(data) : null), [data]);
  const change = useMemo(() => {
    if (!data) return null;
    const mid = addDays(from, Math.floor(days / 2));
    const a = weightedScore(data.headlines.filter((h) => h.published_at.slice(0, 10) < mid));
    const b = weightedScore(data.headlines.filter((h) => h.published_at.slice(0, 10) >= mid));
    return a == null || b == null ? null : b - a;
  }, [data, from, days]);

  const rows = useMemo(() => {
    const list = (data?.headlines ?? []).filter((h) =>
      (filter === "all" || h.sentiment?.label === filter) && (!q || h.title.toLowerCase().includes(q.toLowerCase())),
    );
    return list;
  }, [data, filter, q]);
  const PER = 12;
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const pageRows = rows.slice(page * PER, page * PER + PER);

  if (error) return <EmptyState title="Could not load data" body={String((error as Error).message)} />;

  return (
    <>
      <PageTitle title={`${pair} sentiment`} subtitle={`${from} → ${to}`} />
      {isLoading || !sum ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Avg sentiment" value={fmtScore(sum.avg)} accent={scoreTone(sum.avg)}
            tip="Relevance-weighted average of headline scores. −1 = strongly bearish for the pair, +1 = strongly bullish.">
            <ScoreGauge value={sum.avg} />
          </StatCard>
          <StatCard label="Label counts" value={
            <span className="flex gap-3 text-xl"><span className="text-bull">{sum.bullish}↑</span><span className="text-bear">{sum.bearish}↓</span><span className="text-neutral">{sum.neutral}–</span></span>
          } sub="Bullish · Bearish · Neutral" />
          <StatCard label="Headlines analyzed" value={sum.analyzed} sub={`${sum.total} fetched`} />
          <StatCard label="Sentiment change" value={fmtScore(change)} accent={scoreTone(change)}
            tip="Average score in the second half of the range minus the first half." sub="2nd half vs 1st half of range" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Daily sentiment vs price" tip="Line: daily average sentiment (left axis). Dashed: daily reference rate (right axis).">
          {isLoading ? <Skeleton className="h-72" /> : sum?.analyzed ? (
            <div className="h-72">
              <ResponsiveContainer>
                <ComposedChart data={daily.map((d) => ({ ...d, label: d.date.slice(5) }))}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} />
                  <YAxis yAxisId="s" domain={[-1, 1]} tick={axisStyle} width={34} />
                  <YAxis yAxisId="p" orientation="right" domain={["auto", "auto"]} tick={axisStyle} width={54} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="s" dataKey="avgSentiment" name="Sentiment" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} connectNulls />
                  <Line yAxisId="p" dataKey="close" name="Price" stroke="var(--chart-2)" strokeDasharray="5 4" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No headlines yet." body="Click Refresh data, or turn on Demo data." />}
        </SectionCard>
        <SectionCard title="Daily label mix">
          {isLoading ? <Skeleton className="h-72" /> : sum?.analyzed ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={daily.map((d) => ({ ...d, label: d.date.slice(5) }))}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} />
                  <YAxis tick={axisStyle} width={30} allowDecimals={false} />
                  <Tooltip contentStyle={tipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="bullish" stackId="a" fill="var(--bull)" name="Bullish" />
                  <Bar dataKey="neutral" stackId="a" fill="var(--neutral)" name="Neutral" />
                  <Bar dataKey="bearish" stackId="a" fill="var(--bear)" name="Bearish" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No headlines yet." body="Click Refresh data, or turn on Demo data." />}
        </SectionCard>
      </div>

      <SectionCard title="Headlines" className="mt-6" action={
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search headlines" className="h-9 w-52 pl-8" />
          </div>
          <div className="inline-flex rounded-lg border p-0.5">
            {(["all", "bullish", "bearish", "neutral"] as const).map((f) => (
              <button key={f} onClick={() => { setFilter(f); setPage(0); }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
        </div>
      }>
        {isLoading ? <Skeleton className="h-64" /> : !rows.length ? (
          <EmptyState title={data?.headlines.length ? "No headlines match your filters." : "No headlines yet. Click Refresh data"} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 py-2" /><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Headline</th><th className="py-2 pr-3">Sentiment</th><th className="py-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((h) => (
                    <Fragment key={h.id}>
                      <tr className="cursor-pointer border-b hover:bg-muted/50" onClick={() => setOpen(open === h.id ? null : h.id)}>
                        <td className="py-2.5 text-muted-foreground">{open === h.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3 tabular text-muted-foreground">{h.published_at.slice(5, 16).replace("T", " ")}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{h.source}</td>
                        <td className="py-2.5 pr-3">
                          <a href={h.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-start gap-1 font-medium hover:text-primary">
                            {h.title}<ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                          </a>
                        </td>
                        <td className="py-2.5 pr-3">{h.sentiment ? <SentimentBadge label={h.sentiment.label} /> : <span className="text-xs text-muted-foreground">Pending</span>}</td>
                        <td className="py-2.5 text-right tabular">{h.sentiment ? `${Math.round(h.sentiment.confidence * 100)}%` : "—"}</td>
                      </tr>
                      {open === h.id && (
                        <tr className="border-b bg-muted/40">
                          <td />
                          <td colSpan={5} className="py-3 pr-3 text-sm">
                            <span className="font-medium">Model reasoning: </span>
                            <span className="text-muted-foreground">{h.sentiment?.reasoning ?? "Not analyzed yet."}</span>
                            {h.sentiment && <span className="ml-2 text-xs text-muted-foreground tabular">score {fmtScore(h.sentiment.score)} · relevance {h.sentiment.relevance.toFixed(2)}</span>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{rows.length} headlines</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="tabular">{page + 1} / {pages}</span>
                <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}
