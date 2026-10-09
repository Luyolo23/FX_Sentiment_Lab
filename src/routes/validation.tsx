import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/fx/AppShell";
import { EmptyState, SectionCard, StatCard, fmtScore } from "@/components/fx/bits";
import { useAppState, useFxData } from "@/lib/app-state";
import { LAGS, computeValidation } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/validation")({
  head: () => ({
    meta: [
      { title: "Validation · FX Sentiment Lab" },
      { name: "description", content: "Does news sentiment relate to subsequent FX price moves? Correlation and hit rate." },
      { property: "og:title", content: "Validation · FX Sentiment Lab" },
      { property: "og:description", content: "Correlation and hit rate between daily news sentiment and FX price changes." },
    ],
  }),
  component: Validation,
});

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function Validation() {
  const { pair, from, to } = useAppState();
  const { data, isLoading } = useFxData();
  const [lag, setLag] = useState(1);
  const v = useMemo(() => (data ? computeValidation(data, from, to, lag) : null), [data, from, to, lag]);

  const line = useMemo(() => {
    if (!v?.reg || !v.points.length) return [];
    const xs = v.points.map((p) => p.sentiment);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return [lo, hi].map((x) => ({ sentiment: x, trend: v.reg!.intercept + v.reg!.slope * x }));
  }, [v]);

  return (
    <>
      <PageTitle title="Validation" subtitle={`Does ${pair} sentiment line up with price moves?`} action={
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Lag">
          {LAGS.map((l) => (
            <button key={l.v} onClick={() => setLag(l.v)}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", lag === l.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {l.label}
            </button>
          ))}
        </div>
      } />
      {isLoading || !v ? <Skeleton className="h-96 rounded-xl" /> : !v.n ? (
        <EmptyState title="Not enough data to validate." body="You need days with both analyzed headlines and price data. Click Refresh data or enable Demo data." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pearson correlation" value={v.r == null ? "—" : v.r.toFixed(2)}
              sub={v.p != null ? `approx. p = ${v.p.toFixed(3)}` : undefined}
              tip="Measures how closely two series move together in a straight line, from −1 (opposite) through 0 (none) to +1 (together).">
            </StatCard>
            <StatCard label="Hit rate" value={v.hit ? `${Math.round(v.hit.rate * 100)}%` : "—"}
              sub={v.hit ? `${v.hit.hits} of ${v.hit.n} directional days (coin flip ≈ 50%)` : undefined}
              tip="Share of days where the sign of sentiment (bullish/bearish) matched the sign of the price change. Near-neutral days are excluded." />
            <StatCard label="Sample size" value={`${v.n} days`} sub="Days with sentiment and price data" />
          </div>

          <div className={cn("mt-4 rounded-xl border p-4 text-sm", v.n < 20 ? "border-warning bg-warning-soft" : "bg-accent")}>
            {v.n < 20 && (
              <p className="mb-1 flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" /> Caution: small sample ({v.n} days, under 20)
              </p>
            )}
            <p>{v.text} Correlation does not imply causation.</p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <SectionCard title="Sentiment vs price change" className="lg:col-span-3" tip="Each dot is one day. The line is a least-squares trend line.">
              <div className="h-80">
                <ResponsiveContainer>
                  <ComposedChart margin={{ left: 0, right: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="sentiment" name="Sentiment" domain={[-1, 1]} tick={axisStyle}
                      label={{ value: "Avg sentiment", position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis type="number" dataKey="change" name="Change %" tick={axisStyle} width={44} unit="%" />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      formatter={(val: number) => val.toFixed(3)} />
                    <Scatter data={v.points} fill="var(--chart-1)" />
                    <Line data={line} dataKey="trend" stroke="var(--bear)" strokeDasharray="6 4" dot={false} strokeWidth={2} legendType="none" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Daily values" className="lg:col-span-2">
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[360px] text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Date</th><th className="py-2 text-right">Sentiment</th><th className="py-2 text-right">Count</th><th className="py-2 text-right">Δ Price</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {v.points.map((p) => (
                      <tr key={p.date} className="border-b">
                        <td className="py-2">{p.date}</td>
                        <td className="py-2 text-right">{fmtScore(p.sentiment)}</td>
                        <td className="py-2 text-right">{p.count}</td>
                        <td className={cn("py-2 text-right", p.change > 0 ? "text-bull" : p.change < 0 ? "text-bear" : "")}>{p.change > 0 ? "+" : ""}{p.change.toFixed(3)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
