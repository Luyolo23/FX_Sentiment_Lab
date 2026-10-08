import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { GROQ_MODEL, PAIRS, getPair } from "./pairs";
import { FriendlyError, groqChat, parseLooseJson } from "./groq.server";

const pairSchema = z.enum(PAIRS.map((p) => p.id) as [string, ...string[]]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rangeInput = z.object({ pair: pairSchema, from: dateSchema, to: dateSchema });

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof FriendlyError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const fetchNews = createServerFn({ method: "POST" })
  .inputValidator((d) => rangeInput.parse(d))
  .handler(async ({ data }): Promise<Result<{ inserted: number; found: number }>> => {
    try {
      const key = process.env["NEWS_API_KEY"];
      if (!key) throw new FriendlyError("NewsAPI key is not configured yet. Add NEWS_API_KEY to continue.");
      const pair = getPair(data.pair)!;
      const params = new URLSearchParams({
        q: pair.keywords,
        language: "en",
        sortBy: "publishedAt",
        from: data.from,
        to: data.to,
        pageSize: "100",
      });
      const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
        headers: { "X-Api-Key": key, "User-Agent": "FX-Sentiment-Lab/1.0" },
      });
      const j = (await res.json()) as {
        status: string;
        message?: string;
        articles?: { title: string; description: string | null; url: string; publishedAt: string; source?: { name?: string } }[];
      };
      if (!res.ok || j.status !== "ok") {
        console.error("NewsAPI", res.status, j.message);
        if (res.status === 401) throw new FriendlyError("NewsAPI rejected the API key. Please check NEWS_API_KEY.");
        if (res.status === 429) throw new FriendlyError("NewsAPI daily limit reached. Try again later.");
        throw new FriendlyError(j.message ? `NewsAPI: ${j.message}` : "Could not fetch news.");
      }
      const seen = new Set<string>();
      const rows = (j.articles ?? [])
        .filter((a) => a.url && a.title && a.title !== "[Removed]")
        .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
        .map((a) => ({
          pair: pair.id,
          title: a.title.slice(0, 500),
          description: a.description?.slice(0, 1000) ?? null,
          source: a.source?.name ?? null,
          url: a.url,
          published_at: a.publishedAt,
        }));
      if (!rows.length) return { ok: true, data: { inserted: 0, found: 0 } };
      const db = await admin();
      const { data: ins, error } = await db
        .from("headlines")
        .upsert(rows, { onConflict: "pair,url", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return { ok: true, data: { inserted: ins?.length ?? 0, found: rows.length } };
    } catch (e) {
      return fail(e);
    }
  });

const SYSTEM_PROMPT =
  "You are a forex news analyst. For the given currency pair, classify each headline by its likely effect on the PAIR price: bullish means the base currency is likely to strengthen against the quote currency, bearish means the opposite, neutral means no clear effect or irrelevant. Return JSON: [{id, label, score (-1 to 1), confidence (0 to 1), relevance (0 to 1), reasoning (max 20 words)}]. Judge only from the headline text. Do not invent facts.";

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

export const analyzeSentiment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ pair: pairSchema }).parse(d))
  .handler(async ({ data }): Promise<Result<{ analyzed: number; remaining: number }>> => {
    try {
      const db = await admin();
      const { data: rows, error } = await db
        .from("headlines")
        .select("id, title, sentiments(headline_id)")
        .eq("pair", data.pair)
        .order("published_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const pending = (rows ?? []).filter((r) => !r.sentiments || (Array.isArray(r.sentiments) ? r.sentiments.length === 0 : false));
      const todo = pending.slice(0, 60); // cap per call to stay within request time
      let analyzed = 0;
      for (let i = 0; i < todo.length; i += 10) {
        const batch = todo.slice(i, i + 10);
        const user =
          `Currency pair: ${data.pair}\nHeadlines:\n` +
          batch.map((b, k) => `${k + 1}. id=${b.id} | ${b.title}`).join("\n") +
          `\n\nRespond with a JSON object of the form {"results": [ ... ]} containing exactly one entry per id.`;
        const text = await groqChat({ model: GROQ_MODEL, system: SYSTEM_PROMPT, user, json: true });
        const parsed = parseLooseJson(text) as unknown;
        const list: unknown[] = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object"
            ? ((Object.values(parsed).find(Array.isArray) as unknown[]) ?? [])
            : [];
        const ids = new Set(batch.map((b) => b.id));
        const out = list
          .map((x) => x as Record<string, unknown>)
          .filter((x) => x && ids.has(String(x.id)))
          .map((x) => {
            const raw = String(x.label ?? "").toLowerCase();
            const label = raw === "bullish" || raw === "bearish" ? raw : "neutral";
            let score = clamp(x.score, -1, 1, 0);
            if (label === "bullish" && score < 0) score = -score;
            if (label === "bearish" && score > 0) score = -score;
            return {
              headline_id: String(x.id),
              pair: data.pair,
              label,
              score,
              confidence: clamp(x.confidence, 0, 1, 0.5),
              relevance: clamp(x.relevance, 0, 1, 0.5),
              reasoning: String(x.reasoning ?? "").split(/\s+/).slice(0, 25).join(" ").slice(0, 240) || null,
              model: GROQ_MODEL,
            };
          });
        if (out.length) {
          const { error: e2 } = await db
            .from("sentiments")
            .upsert(out, { onConflict: "headline_id", ignoreDuplicates: true });
          if (e2) throw e2;
          analyzed += out.length;
        }
      }
      return { ok: true, data: { analyzed, remaining: Math.max(0, pending.length - analyzed) } };
    } catch (e) {
      return fail(e);
    }
  });

export const fetchPrices = createServerFn({ method: "POST" })
  .inputValidator((d) => rangeInput.parse(d))
  .handler(async ({ data }): Promise<Result<{ stored: number }>> => {
    try {
      const pair = getPair(data.pair)!;
      // Start a few days earlier so the first day in range has a prior close
      const start = new Date(data.from + "T00:00:00Z");
      start.setUTCDate(start.getUTCDate() - 5);
      const from = start.toISOString().slice(0, 10);
      const res = await fetch(
        `https://api.frankfurter.dev/v1/${from}..${data.to}?base=${pair.base}&symbols=${pair.quote}`,
      );
      if (!res.ok) throw new FriendlyError("Could not load exchange rates from Frankfurter.");
      const j = (await res.json()) as { rates?: Record<string, Record<string, number>> };
      const rows = Object.entries(j.rates ?? {})
        .map(([date, r]) => ({ pair: pair.id, date, close: r[pair.quote] }))
        .filter((r) => Number.isFinite(r.close));
      if (rows.length) {
        const db = await admin();
        const { error } = await db.from("prices").upsert(rows, { onConflict: "pair,date" });
        if (error) throw error;
      }
      return { ok: true, data: { stored: rows.length } };
    } catch (e) {
      return fail(e);
    }
  });

const statsSchema = z.object({
  pair: pairSchema,
  from: dateSchema,
  to: dateSchema,
  lag: z.number().int().min(0).max(2),
  stats: z.record(z.union([z.number(), z.string(), z.null()])),
});

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((d) => statsSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ text: string; model: string }>> => {
    try {
      const system =
        "You write concise, plain-English analytics reports for an educational forex sentiment tool. Use ONLY the numbers provided in the input. Do not add facts, news events, forecasts, or trading advice. Never claim causation; correlation is not causation. If the sample is small or the result is not significant, say so clearly. Output markdown with exactly these sections as level-2 headings: Key findings, Sentiment trend, Validation result, Limitations. Use short bullet points.";
      const user = `Pair: ${data.pair}\nPeriod: ${data.from} to ${data.to}\nLag used for validation: ${data.lag} trading day(s)\nComputed statistics (JSON):\n${JSON.stringify(data.stats, null, 2)}`;
      const text = await groqChat({ model: GROQ_MODEL, system, user });
      return { ok: true, data: { text, model: GROQ_MODEL } };
    } catch (e) {
      return fail(e);
    }
  });
