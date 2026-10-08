const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export class FriendlyError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function groqChat(opts: {
  model: string;
  system: string;
  user: string;
  json?: boolean;
}): Promise<string> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new FriendlyError("Groq API key is not configured yet. Add GROQ_API_KEY to continue.");
  let attempt = 0;
  while (true) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.1,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (res.ok) {
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return j.choices?.[0]?.message?.content ?? "";
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const ra = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt + Math.random() * 400;
      attempt++;
      await sleep(Math.min(wait, 15000));
      continue;
    }
    const body = await res.text();
    console.error("Groq error", res.status, body.slice(0, 500));
    if (res.status === 401) throw new FriendlyError("Groq rejected the API key. Please check GROQ_API_KEY.");
    if (res.status === 429) throw new FriendlyError("Groq rate limit reached. Please wait a minute and try again.");
    throw new FriendlyError(`Groq request failed (status ${res.status}).`);
  }
}

/** Parse JSON tolerant of code fences, prose around it, and trailing commas. */
export function parseLooseJson(text: string): unknown {
  const attempts: string[] = [];
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  attempts.push(cleaned);
  const arr = cleaned.match(/\[[\s\S]*\]/);
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) attempts.push(obj[0]);
  if (arr) attempts.push(arr[0]);
  for (const a of attempts) {
    for (const candidate of [a, a.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        return JSON.parse(candidate);
      } catch {
        /* try next */
      }
    }
  }
  return null;
}
