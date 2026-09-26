import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient as createRedis } from "redis";
import type { Prefs, TripMeta } from "./types";

export interface Brief {
  sig: string;
  model: string;
  at: string;
  headline: string;
  summary: string;
  picks: { option: string; why: string }[];
  watchouts: string[];
  whatsapp: string;
}

interface Backend {
  kind: "supabase" | "redis" | "memory";
  getMeta(id: string): Promise<TripMeta | null>;
  setMeta(meta: TripMeta): Promise<void>;
  getAdminKey(id: string): Promise<string | null>;
  setAdminKey(id: string, key: string): Promise<void>;
  getResponses(id: string): Promise<Record<string, Prefs>>;
  setResponse(id: string, member: string, prefs: Prefs): Promise<void>;
  getBrief(id: string): Promise<Brief | null>;
  setBrief(id: string, brief: Brief): Promise<void>;
  ping(): Promise<void>;
}

/* ---------- Supabase (preferred) ----------
   Tables: trips(id, meta, admin_key, brief) and responses(trip_id, member, prefs). See supabase/schema.sql. */
function supabaseBackend(sb: SupabaseClient): Backend {
  const fail = (what: string, e: { message: string } | null) => {
    if (e) throw new Error(`Supabase ${what} failed: ${e.message}`);
  };
  return {
    kind: "supabase",
    async getMeta(id) {
      const { data, error } = await sb.from("trips").select("meta").eq("id", id).maybeSingle();
      fail("read trip", error);
      return (data?.meta as TripMeta) ?? null;
    },
    async setMeta(meta) {
      const { error } = await sb.from("trips").upsert({ id: meta.id, meta }, { onConflict: "id" });
      fail("save trip", error);
    },
    async getAdminKey(id) {
      const { data, error } = await sb.from("trips").select("admin_key").eq("id", id).maybeSingle();
      fail("read key", error);
      return (data?.admin_key as string) ?? null;
    },
    async setAdminKey(id, key) {
      const { error } = await sb.from("trips").update({ admin_key: key }).eq("id", id);
      fail("save key", error);
    },
    async getResponses(id) {
      const { data, error } = await sb.from("responses").select("member, prefs").eq("trip_id", id);
      fail("read responses", error);
      const out: Record<string, Prefs> = {};
      for (const r of data ?? []) out[r.member as string] = r.prefs as Prefs;
      return out;
    },
    // One row per person (primary key trip_id + member), so simultaneous saves never clash.
    async setResponse(id, member, prefs) {
      const { error } = await sb
        .from("responses")
        .upsert({ trip_id: id, member, prefs, updated_at: new Date().toISOString() }, { onConflict: "trip_id,member" });
      fail("save response", error);
    },
    async getBrief(id) {
      const { data, error } = await sb.from("trips").select("brief").eq("id", id).maybeSingle();
      fail("read briefing", error);
      return (data?.brief as Brief) ?? null;
    },
    async setBrief(id, brief) {
      const { error } = await sb.from("trips").update({ brief }).eq("id", id);
      fail("save briefing", error);
    },
    async ping() {
      const { error } = await sb.from("trips").select("id", { head: true, count: "exact" }).limit(1);
      fail("connection check", error);
    },
  };
}

/* ---------- Key-value backends (Redis / Upstash / memory) ---------- */
const TTL = 60 * 60 * 24 * 180;
interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
}

type G = { __tripRedis?: Promise<ReturnType<typeof createRedis>>; __tripMem?: { kv: Map<string, string>; h: Map<string, Record<string, string>> } };
const g = globalThis as unknown as G;

function tcpKV(url: string): KV {
  const client = () =>
    (g.__tripRedis ??= (async () => {
      const c = createRedis({ url });
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
    async hset(k, f, v) { const c = await client(); await c.hSet(k, f, v); await c.expire(k, TTL); },
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

function memKV(): KV {
  const mem = (g.__tripMem ??= { kv: new Map(), h: new Map() });
  return {
    async get(k) { return mem.kv.get(k) ?? null; },
    async set(k, v) { mem.kv.set(k, v); },
    async hgetall(k) { return mem.h.get(k) ?? {}; },
    async hset(k, f, v) { mem.h.set(k, { ...(mem.h.get(k) ?? {}), [f]: v }); },
  };
}

function parse<T>(v: unknown): T | null {
  if (v == null) return null;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return null; }
}

function kvBackend(kv: KV, kind: "redis" | "memory"): Backend {
  return {
    kind,
    async getMeta(id) { return parse<TripMeta>(await kv.get(`trip:${id}:meta`)); },
    async setMeta(meta) { await kv.set(`trip:${meta.id}:meta`, JSON.stringify(meta)); },
    async getAdminKey(id) { return kv.get(`trip:${id}:admin`); },
    async setAdminKey(id, key) { await kv.set(`trip:${id}:admin`, key); },
    async getResponses(id) {
      const raw = await kv.hgetall(`trip:${id}:resp`);
      const out: Record<string, Prefs> = {};
      for (const [k, v] of Object.entries(raw)) { const p = parse<Prefs>(v); if (p) out[k] = p; }
      return out;
    },
    async setResponse(id, member, prefs) { await kv.hset(`trip:${id}:resp`, member, JSON.stringify(prefs)); },
    async getBrief(id) { return parse<Brief>(await kv.get(`trip:${id}:brief`)); },
    async setBrief(id, brief) { await kv.set(`trip:${id}:brief`, JSON.stringify(brief)); },
    async ping() { await kv.get("ping"); },
  };
}

/* ---------- Pick a backend from environment variables ---------- */
function pickBackend(): Backend {
  const e = process.env;
  const sbUrl = e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SECRET_KEY;
  if (sbUrl && sbKey) {
    return supabaseBackend(createSupabase(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  }
  const redisUrl = e.REDIS_URL || Object.values(e).find((v) => typeof v === "string" && /^rediss?:\/\//.test(v));
  if (redisUrl) return kvBackend(tcpKV(redisUrl), "redis");
  const upUrl = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  const upToken = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (upUrl && upToken) return kvBackend(upstashKV(upUrl, upToken), "redis");
  return kvBackend(memKV(), "memory");
}

const db = pickBackend();

export const storageKind = db.kind;
export const getMeta = db.getMeta;
export const setMeta = db.setMeta;
export const getAdminKey = db.getAdminKey;
export const setAdminKey = db.setAdminKey;
export const getResponses = db.getResponses;
export const setResponse = db.setResponse;
export const getBrief = db.getBrief;
export const setBrief = db.setBrief;
export const pingStore = db.ping;
