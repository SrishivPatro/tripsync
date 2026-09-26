import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { TAGS, TYPES } from "@/lib/destinations";
import { generateJSON, geminiKey } from "@/lib/gemini";
import { evaluate, rupees } from "@/lib/scoring";
import { getBrief, getMeta, getResponses, setBrief, type Brief } from "@/lib/store";
import type { Prefs, TripMeta } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function briefSig(meta: TripMeta, responses: Record<string, Prefs>) {
  const parts = meta.members.map((m) => `${m}:${responses[m]?.updatedAt ?? "-"}`).join("|");
  return createHash("sha1").update(`${parts}|${meta.locked}|${meta.decision?.destId ?? ""}`).digest("hex").slice(0, 16);
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    picks: { type: "ARRAY", items: { type: "OBJECT", properties: { option: { type: "STRING" }, why: { type: "STRING" } }, required: ["option", "why"] } },
    watchouts: { type: "ARRAY", items: { type: "STRING" } },
    whatsapp: { type: "STRING" },
  },
  required: ["headline", "summary", "picks", "watchouts", "whatsapp"],
};

function buildPrompt(meta: TripMeta, responses: Record<string, Prefs>) {
  const ev = evaluate(meta, responses);
  const typeName = (t: string) => TYPES.find((x) => x.id === t)?.label ?? t;
  const tagName = (t: string) => TAGS.find((x) => x.id === t)?.label ?? t;
  const facts = {
    trip: meta.name,
    coordinator: meta.coordinator,
    answered: ev.submitted,
    not_answered_yet: ev.pending,
    responses_locked: meta.locked,
    ranked_options: ev.recommended.map((o, i) => ({
      rank: i + 1,
      destination: `${o.dest.name} (${o.dest.region})`,
      dates: `${o.window.label}: ${o.window.start} to ${o.window.end}`,
      est_cost_per_person: rupees(o.cost),
      group_fit_out_of_100: o.groupScore,
      in_season: o.inSeason,
      trip_types: o.dest.types.map(typeName),
      people: o.fits.map((f) => ({ name: f.member, verdict: f.status, reasons: f.reasons.map((r) => r.text) })),
    })),
    ruled_out_by_one_person: ev.closeCalls.map((o) => ({
      destination: o.dest.name, dates: o.window.label, blocked_by: o.blockers[0]?.member,
      because: o.blockers[0]?.reasons.filter((r) => r.tone === "bad").map((r) => r.text),
    })),
    shared_ground: {
      budget_everyone_can_manage: rupees(ev.overlap.budgetEveryoneCan ?? 0),
      dates_nobody_ruled_out: ev.overlap.datesEveryoneCan.map((w) => w.label),
      dealbreakers: ev.overlap.wontDos.map((x) => `${x.who.join(", ")}: ${tagName(x.tag)}`),
    },
    notes_from_people: ev.submitted.filter((m) => responses[m].note).map((m) => ({ name: m, note: responses[m].note })),
  };
  return `You help a group of Indian college friends finally agree on a trip. A scoring system has ALREADY ranked the options fairly; do not re-rank, add destinations, or invent prices, dates or facts. Use only the data below.

Write:
- headline: max 12 words naming the top pick and why it wins.
- summary: 2-3 plain sentences explaining why the top option works for everyone, mentioning anyone for whom it's only "okay" or "stretch".
- picks: one entry per ranked option (same order), "option" = destination name, "why" = one sentence on who it suits best and the trade-off.
- watchouts: up to 3 short, specific things the coordinator should handle (use people's notes, "if needed" dates, budget stretches, people who haven't answered). Empty list if none.
- whatsapp: a friendly, casual message (max 600 characters, 1-2 emojis) from ${meta.coordinator} to the group proposing the top pick with dates and rough cost, briefly naming the backup, and asking everyone to reply 👍 or say what's stopping them.

DATA:
${JSON.stringify(facts, null, 2)}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!geminiKey()) return NextResponse.json({ enabled: false });
  const meta = await getMeta(id);
  if (!meta) return NextResponse.json({ error: "No trip found at this link." }, { status: 404 });
  const responses = await getResponses(id);
  const ev = evaluate(meta, responses);
  if (ev.recommended.length === 0) return NextResponse.json({ enabled: true, brief: null, reason: "No options that work for everyone yet." });

  const sig = briefSig(meta, responses);
  const cached = await getBrief(id);
  if (cached && cached.sig === sig) return NextResponse.json({ enabled: true, brief: cached });

  try {
    const { data, model } = await generateJSON<Omit<Brief, "sig" | "model" | "at">>(buildPrompt(meta, responses), SCHEMA);
    const brief: Brief = {
      sig, model, at: new Date().toISOString(),
      headline: String(data.headline ?? "").slice(0, 140),
      summary: String(data.summary ?? "").slice(0, 700),
      picks: (Array.isArray(data.picks) ? data.picks : []).slice(0, 3).map((p) => ({ option: String(p.option), why: String(p.why).slice(0, 300) })),
      watchouts: (Array.isArray(data.watchouts) ? data.watchouts : []).slice(0, 3).map((w) => String(w).slice(0, 200)),
      whatsapp: String(data.whatsapp ?? "").slice(0, 900),
    };
    await setBrief(id, brief);
    return NextResponse.json({ enabled: true, brief });
  } catch (e) {
    console.error(e);
    // Fall back to the last briefing if there is one, clearly marked as out of date.
    return NextResponse.json({ enabled: true, brief: cached ?? null, stale: Boolean(cached), error: "Gemini couldn't write the briefing right now." });
  }
}
