import { NextResponse } from "next/server";
import { randomId } from "@/lib/ids";
import { setAdminKey, setMeta } from "@/lib/store";
import type { DateWindow, TripMeta } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send the trip details as JSON." }, { status: 400 });

  const name = String(body.name ?? "").trim().slice(0, 80);
  const coordinator = String(body.coordinator ?? "").trim().slice(0, 40);
  const members: string[] = Array.from(
    new Set<string>(
      (Array.isArray(body.members) ? body.members : [])
        .map((m: unknown) => String(m).trim().slice(0, 40))
        .filter(Boolean),
    ),
  );
  if (coordinator && !members.includes(coordinator)) members.unshift(coordinator);

  const windows: DateWindow[] = (Array.isArray(body.windows) ? body.windows : [])
    .map((w: { label?: string; start?: string; end?: string }) => ({
      id: randomId(5),
      label: String(w.label ?? "").trim().slice(0, 40),
      start: String(w.start ?? ""),
      end: String(w.end ?? ""),
    }))
    .filter((w: DateWindow) => DATE.test(w.start) && DATE.test(w.end) && w.end > w.start)
    .map((w: DateWindow) => ({ ...w, label: w.label || `${w.start} to ${w.end}` }));

  if (!name) return NextResponse.json({ error: "Give the trip a name." }, { status: 400 });
  if (!coordinator) return NextResponse.json({ error: "Add your own name." }, { status: 400 });
  if (members.length < 2) return NextResponse.json({ error: "Add at least one friend." }, { status: 400 });
  if (members.length > 12) return NextResponse.json({ error: "This works for up to 12 people." }, { status: 400 });
  if (!windows.length)
    return NextResponse.json({ error: "Add at least one date window where the end date is after the start date." }, { status: 400 });

  const meta: TripMeta = {
    id: randomId(8), name, coordinator, members, windows,
    createdAt: new Date().toISOString(), locked: false,
  };
  const adminKey = randomId(16);
  await setMeta(meta);
  await setAdminKey(meta.id, adminKey);
  return NextResponse.json({ id: meta.id, adminKey });
}
