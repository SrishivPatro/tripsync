// Minimal Gemini client using the REST API (no SDK needed).
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

const g = globalThis as unknown as { __geminiModel?: string };

// If the configured model isn't available to this key, ask the API which Flash models it can use.
async function discoverModel(key: string): Promise<string | null> {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!r.ok) return null;
  const data = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const names = (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => /flash/.test(n) && !/(image|tts|audio|live|omni|embed|vision|thinking|exp)/.test(n));
  const version = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  names.sort((a, b) => {
    const pa = a.includes("preview") ? 1 : 0, pb = b.includes("preview") ? 1 : 0;
    return pa - pb || version(b) - version(a);
  });
  return names[0] ?? null;
}

async function call(model: string, key: string, body: unknown) {
  return fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
}

export async function generateJSON<T>(prompt: string, schema: object): Promise<{ data: T; model: string }> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
  };
  let model = g.__geminiModel || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let r = await call(model, key, body);
  if (r.status === 404 || r.status === 400) {
    const found = await discoverModel(key);
    if (found && found !== model) {
      model = found;
      r = await call(model, key, body);
    }
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gemini ${model} returned ${r.status}: ${t.slice(0, 300)}`);
  }
  g.__geminiModel = model;
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const clean = text.replace(/```json|```/g, "").trim();
  return { data: JSON.parse(clean) as T, model };
}
