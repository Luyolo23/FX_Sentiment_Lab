import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAIRS, type RangeDays } from "./pairs";
import { buildDemo } from "./demo";
import { dateRange } from "./stats";
import type { Dataset, HeadlineRow, Label } from "./types";

type State = {
  pair: string;
  setPair: (p: string) => void;
  days: RangeDays;
  setDays: (d: RangeDays) => void;
  demo: boolean;
  setDemo: (d: boolean) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  from: string;
  to: string;
};

const Ctx = createContext<State | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [pair, setPair] = useState(PAIRS[0].id);
  const [days, setDays] = useState<RangeDays>(14);
  const [demo, setDemo] = useState(true);
  const [dark, setDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("fxsl") ?? "{}");
      if (s.pair) setPair(s.pair);
      if (s.days) setDays(s.days);
      if (typeof s.demo === "boolean") setDemo(s.demo);
      if (typeof s.dark === "boolean") setDark(s.dark);
      else setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("fxsl", JSON.stringify({ pair, days, demo, dark }));
    document.documentElement.classList.toggle("dark", dark);
  }, [pair, days, demo, dark, loaded]);

  const { from, to } = useMemo(() => dateRange(days), [days]);

  return (
    <Ctx.Provider value={{ pair, setPair, days, setDays, demo, setDemo, dark, setDark, from, to }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppState outside provider");
  return c;
}

async function loadLive(pair: string, from: string, to: string): Promise<Dataset> {
  const [h, p] = await Promise.all([
    supabase
      .from("headlines")
      .select("id, pair, title, description, source, url, published_at, sentiments(label, score, confidence, relevance, reasoning, model)")
      .eq("pair", pair)
      .gte("published_at", `${from}T00:00:00Z`)
      .lte("published_at", `${to}T23:59:59Z`)
      .order("published_at", { ascending: false })
      .limit(1000),
    supabase
      .from("prices")
      .select("pair, date, close")
      .eq("pair", pair)
      .gte("date", (() => { const d = new Date(from + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 5); return d.toISOString().slice(0, 10); })())
      .lte("date", to)
      .order("date"),
  ]);
  if (h.error) throw h.error;
  if (p.error) throw p.error;
  const headlines: HeadlineRow[] = (h.data ?? []).map((r) => {
    const s = Array.isArray(r.sentiments) ? r.sentiments[0] : r.sentiments;
    return {
      id: r.id, pair: r.pair, title: r.title, description: r.description, source: r.source, url: r.url,
      published_at: r.published_at,
      sentiment: s ? { ...s, label: s.label as Label } : null,
    };
  });
  return { headlines, prices: p.data ?? [] };
}

export function useFxData() {
  const { pair, from, to, demo } = useAppState();
  return useQuery({
    queryKey: ["fx", pair, from, to, demo],
    queryFn: () => (demo ? Promise.resolve(buildDemo(pair, from, to)) : loadLive(pair, from, to)),
    staleTime: 60_000,
  });
}
