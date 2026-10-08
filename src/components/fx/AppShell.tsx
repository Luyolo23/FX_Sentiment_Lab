import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Check, Loader2, Moon, RefreshCw, Sun, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppState } from "@/lib/app-state";
import { PAIRS, RANGES, type RangeDays } from "@/lib/pairs";
import { analyzeSentiment, fetchNews, fetchPrices } from "@/lib/fx.functions";
import { cn } from "@/lib/utils";
import { DISCLAIMER } from "./bits";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/validation", label: "Validation" },
  { to: "/report", label: "Report" },
  { to: "/methodology", label: "Methodology" },
] as const;

type StepState = "idle" | "running" | "done" | "error";
const STEPS = ["Fetching news headlines", "Classifying sentiment", "Fetching daily prices"];

function RefreshButton() {
  const { pair, from, to, demo } = useAppState();
  const qc = useQueryClient();
  const news = useServerFn(fetchNews);
  const analyze = useServerFn(analyzeSentiment);
  const prices = useServerFn(fetchPrices);
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(["idle", "idle", "idle"]);
  const [msgs, setMsgs] = useState<string[]>(["", "", ""]);
  const busy = steps.includes("running");

  const set = (i: number, s: StepState, m = "") => {
    setSteps((p) => p.map((v, k) => (k === i ? s : v)));
    setMsgs((p) => p.map((v, k) => (k === i ? m : v)));
  };

  async function run() {
    if (demo) {
      toast.info("Turn off Demo data to refresh live data.");
      return;
    }
    setOpen(true);
    setSteps(["idle", "idle", "idle"]);
    setMsgs(["", "", ""]);
    set(0, "running");
    const a = await news({ data: { pair, from, to } });
    if (!a.ok) { set(0, "error", a.error); toast.error(a.error); return; }
    set(0, "done", `${a.data.found} found, ${a.data.inserted} new`);
    set(1, "running");
    const b = await analyze({ data: { pair } });
    if (!b.ok) { set(1, "error", b.error); toast.error(b.error); }
    else set(1, "done", `${b.data.analyzed} classified${b.data.remaining ? `, ${b.data.remaining} still pending (refresh again)` : ""}`);
    set(2, "running");
    const c = await prices({ data: { pair, from, to } });
    if (!c.ok) { set(2, "error", c.error); toast.error(c.error); }
    else set(2, "done", `${c.data.stored} daily rates stored`);
    await qc.invalidateQueries({ queryKey: ["fx"] });
    if (b.ok && c.ok) toast.success(`${pair} data refreshed`);
  }

  return (
    <>
      <Button size="sm" onClick={run} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh data
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refreshing {pair}</DialogTitle>
            <DialogDescription>{from} to {to}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    steps[i] === "done" && "border-bull bg-bull-soft text-bull",
                    steps[i] === "error" && "border-bear bg-bear-soft text-bear",
                    steps[i] === "running" && "border-primary text-primary",
                  )}
                >
                  {steps[i] === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : steps[i] === "done" ? <Check className="h-3.5 w-3.5" />
                    : steps[i] === "error" ? <X className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{s}</p>
                  {msgs[i] && <p className={cn("text-xs", steps[i] === "error" ? "text-bear" : "text-muted-foreground")}>{msgs[i]}</p>}
                </div>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pair, setPair, days, setDays, demo, setDemo, dark, setDark } = useAppState();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-navy-foreground">
              <Activity className="h-4 w-4" />
            </span>
            FX Sentiment Lab
          </Link>
          <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
                activeOptions={{ exact: true }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="border-t bg-card/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Currency pair"><SelectValue /></SelectTrigger>
              <SelectContent>{PAIRS.map((p) => <SelectItem key={p.id} value={p.id}>{p.id}</SelectItem>)}</SelectContent>
            </Select>
            <div className="inline-flex rounded-lg border bg-background p-0.5" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r as RangeDays)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium tabular transition-colors",
                    days === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo data" />
              Demo data
            </label>
            {demo && (
              <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">DEMO DATA</span>
            )}
            <div className="ml-auto"><RefreshButton /></div>
          </div>
        </div>
      </header>
      {demo && (
        <div className="hidden print:block px-6 pt-4 text-xs font-semibold">DEMO DATA — synthetic sample</div>
      )}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>{DISCLAIMER}</span>
          <span>Headlines: NewsAPI · Rates: Frankfurter (ECB reference) · Sentiment: Groq Llama</span>
        </div>
      </footer>
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
