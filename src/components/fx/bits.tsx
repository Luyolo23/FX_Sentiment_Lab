import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Label } from "@/lib/types";

export function SentimentBadge({ label, className }: { label: Label; className?: string }) {
  const map = {
    bullish: { Icon: ArrowUpRight, cls: "bg-bull-soft text-bull", text: "Bullish" },
    bearish: { Icon: ArrowDownRight, cls: "bg-bear-soft text-bear", text: "Bearish" },
    neutral: { Icon: Minus, cls: "bg-neutral-soft text-neutral", text: "Neutral" },
  }[label];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", map.cls, className)}>
      <map.Icon className="h-3.5 w-3.5" aria-hidden />
      {map.text}
    </span>
  );
}

export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="More info">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

export function StatCard({
  label, value, sub, tip, accent, children,
}: { label: string; value: ReactNode; sub?: ReactNode; tip?: ReactNode; accent?: "bull" | "bear" | "neutral"; children?: ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tabular tracking-tight",
          accent === "bull" && "text-bull",
          accent === "bear" && "text-bear",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      {children}
    </div>
  );
}

export function SectionCard({ title, tip, action, children, className }: { title: string; tip?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-surface p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {title}
          {tip && <InfoTip>{tip}</InfoTip>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

export function scoreTone(v: number | null | undefined): "bull" | "bear" | "neutral" {
  if (v == null) return "neutral";
  return v > 0.05 ? "bull" : v < -0.05 ? "bear" : "neutral";
}

export function fmtScore(v: number | null | undefined) {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2);
}

export function ScoreGauge({ value }: { value: number | null }) {
  const pct = value == null ? 50 : ((value + 1) / 2) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-bear via-neutral-soft to-bull">
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Bearish −1</span><span>0</span><span>+1 Bullish</span>
      </div>
    </div>
  );
}

export const DISCLAIMER = "For educational purposes only. Not financial advice.";
