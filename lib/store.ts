import { Redis } from "@upstash/redis";
import type { Prefs, TripMeta } from "./types";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const storageKind: "redis" | "memory" = redis ? "redis" : "memory";

const TTL = 60 * 60 * 24 * 180; // keep trips for 180 days

// Local-dev fallback. Not reliable on Vercel (each function instance has its own memory).
type Mem = { meta: Map<string, TripMeta>; admin: Map<string, string>; resp: Map<string, Record<string, Prefs>> };
const g = globalThis as unknown as { __tripMem?: Mem };
const mem: Mem = (g.__tripMem ??= { meta: new Map(), admin: new Map(), resp: new Map() });

function parse<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

export async function getMeta(id: string): Promise<TripMeta | null> {
  if (!redis) return mem.meta.get(id) ?? null;
  return parse<TripMeta>(await redis.get(`trip:${id}:meta`));
}

export async function setMeta(meta: TripMeta) {
  if (!redis) return void mem.meta.set(meta.id, meta);
  await redis.set(`trip:${meta.id}:meta`, JSON.stringify(meta), { ex: TTL });
}

export async function getAdminKey(id: string): Promise<string | null> {
  if (!redis) return mem.admin.get(id) ?? null;
  const v = await redis.get(`trip:${id}:admin`);
  return v == null ? null : String(v);
}

export async function setAdminKey(id: string, key: string) {
  if (!redis) return void mem.admin.set(id, key);
  await redis.set(`trip:${id}:admin`, key, { ex: TTL });
}

export async function getResponses(id: string): Promise<Record<string, Prefs>> {
  if (!redis) return mem.resp.get(id) ?? {};
  const raw = (await redis.hgetall(`trip:${id}:resp`)) ?? {};
  const out: Record<string, Prefs> = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = parse<Prefs>(v);
    if (p) out[k] = p;
  }
  return out;
}

// One hash field per person, so two friends saving at the same moment can't overwrite each other.
export async function setResponse(id: string, member: string, prefs: Prefs) {
  if (!redis) {
    const cur = mem.resp.get(id) ?? {};
    cur[member] = prefs;
    return void mem.resp.set(id, cur);
  }
  await redis.hset(`trip:${id}:resp`, { [member]: JSON.stringify(prefs) });
  await redis.expire(`trip:${id}:resp`, TTL);
}
