import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";
import type { Prefs, TripMeta } from "./types";

const TTL = 60 * 60 * 24 * 180; // keep trips for 180 days

// Minimal interface both drivers satisfy.
interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
}

// 1) A standard redis:// URL (Vercel's Redis integration). Any variable name works, e.g. REDIS_URL or STORAGE_URL.
const redisUrl =
  process.env.REDIS_URL ||
  Object.values(process.env).find((v) => typeof v === "string" && /^rediss?:\/\//.test(v));

// 2) Upstash REST credentials.
const upUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const upToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

type G = { __tripRedis?: Promise<ReturnType<typeof createClient>> };
const g = globalThis as unknown as G;

function tcpKV(url: string): KV {
  const client = () =>
    (g.__tripRedis ??= (async () => {
      const c = createClient({ url });
      c.on("error", (e) => console.error("Redis error", e));
      await c.connect();
      return c;
    })().catch((e) => {
      g.__tripRedis = undefined;
      throw e;
    }));
  return {
    async get(k) { return (await client()).get(k); },
    async set(k, v) { await (await client()).set(k, v, { EX: TTL }); },
    async hgetall(k) { return (await (await client()).hGetAll(k)) ?? {}; },
    async hset(k, f, v) {
      const c = await client();
      await c.hSet(k, f, v);
      await c.expire(k, TTL);
    },
  };
}

function upstashKV(url: string, token: string): KV {
  const r = new UpstashRedis({ url, token, automaticDeserialization: false });
  return {
    async get(k) { const v = await r.get<string>(k); return v == null ? null : String(v); },
    async set(k, v) { await r.set(k, v, { ex: TTL }); },
    async hgetall(k) { return ((await r.hgetall<Record<string, string>>(k)) ?? {}) as Record<string, string>; },
    async hset(k, f, v) { await r.hset(k, { [f]: v }); await r.expire(k, TTL); },
  };
}

// 3) Local-dev fallback. Not reliable on Vercel (each function instance has its own memory).
type Mem = { kv: Map<string, string>; h: Map<string, Record<string, string>> };
const gm = globalThis as unknown as { __tripMem?: Mem };
const mem: Mem = (gm.__tripMem ??= { kv: new Map(), h: new Map() });
const memKV: KV = {
  async get(k) { return mem.kv.get(k) ?? null; },
  async set(k, v) { mem.kv.set(k, v); },
  async hgetall(k) { return mem.h.get(k) ?? {}; },
  async hset(k, f, v) { mem.h.set(k, { ...(mem.h.get(k) ?? {}), [f]: v }); },
};

const kv: KV = redisUrl ? tcpKV(redisUrl) : upUrl && upToken ? upstashKV(upUrl, upToken) : memKV;
export const storageKind: "redis" | "memory" = redisUrl || (upUrl && upToken) ? "redis" : "memory";

function parse<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return null; }
}

export async function getMeta(id: string) {
  return parse<TripMeta>(await kv.get(`trip:${id}:meta`));
}
export async function setMeta(meta: TripMeta) {
  await kv.set(`trip:${meta.id}:meta`, JSON.stringify(meta));
}
export async function getAdminKey(id: string) {
  return kv.get(`trip:${id}:admin`);
}
export async function setAdminKey(id: string, key: string) {
  await kv.set(`trip:${id}:admin`, key);
}
export async function getResponses(id: string): Promise<Record<string, Prefs>> {
  const raw = await kv.hgetall(`trip:${id}:resp`);
  const out: Record<string, Prefs> = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = parse<Prefs>(v);
    if (p) out[k] = p;
  }
  return out;
}
// One hash field per person, so two friends saving at the same moment can't overwrite each other.
export async function setResponse(id: string, member: string, prefs: Prefs) {
  await kv.hset(`trip:${id}:resp`, member, JSON.stringify(prefs));
}
