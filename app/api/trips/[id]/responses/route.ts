import { NextResponse } from "next/server";
import { CITIES, TAGS, TYPES } from "@/lib/destinations";
import { getMeta, setResponse } from "@/lib/store";
import type { Avail, City, Feel, Prefs, Tag, TypeId } from "@/lib/types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getMeta(id);
  if (!meta) return NextResponse.json({ error: "No trip found at this link." }, { status: 404 });
  if (meta.locked)
    return NextResponse.json({ error: `${meta.coordinator} has locked responses, so preferences can't change now.` }, { status: 409 });

  const b = await req.json().catch(() => null);
  if (!b || !meta.members.includes(b.member))
    return NextResponse.json({ error: "Pick your name from the list first." }, { status: 400 });
  if (!CITIES.includes(b.homeCity))
    return NextResponse.json({ error: "Choose the city you'll travel from." }, { status: 400 });

  const avail: Record<string, Avail> = {};
  for (const w of meta.windows) {
    const v = b.avail?.[w.id];
    if (v !== "yes" && v !== "maybe" && v !== "no")
      return NextResponse.json({ error: `Answer every date window, including ${w.label}.` }, { status: 400 });
    avail[w.id] = v;
  }
  const types = {} as Record<TypeId, Feel>;
  for (const t of TYPES) {
    const v = b.types?.[t.id];
    types[t.id] = v === "love" || v === "no" ? v : "fine";
  }
  const wontDo: Tag[] = (Array.isArray(b.wontDo) ? b.wontDo : []).filter((t: Tag) => TAGS.some((x) => x.id === t));

  const budgetComfort = clamp(Number(b.budgetComfort) || 0, 1000, 200000);
  const budgetMax = Math.max(budgetComfort, clamp(Number(b.budgetMax) || 0, 1000, 200000));

  const prefs: Prefs = {
    member: b.member,
    homeCity: b.homeCity as City,
    budgetComfort,
    budgetMax,
    maxHours: clamp(Number(b.maxHours) || 6, 1, 24),
    avail,
    types,
    wontDo,
    note: String(b.note ?? "").trim().slice(0, 280) || undefined,
    updatedAt: new Date().toISOString(),
  };
  await setResponse(id, prefs.member, prefs);
  return NextResponse.json({ ok: true, prefs });
}
