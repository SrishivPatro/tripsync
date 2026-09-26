import { NextResponse } from "next/server";
import { destById } from "@/lib/destinations";
import { getAdminKey, getMeta, setMeta } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const [meta, key] = await Promise.all([getMeta(id), getAdminKey(id)]);
  if (!meta) return NextResponse.json({ error: "No trip found at this link." }, { status: 404 });
  if (!b || !key || b.key !== key)
    return NextResponse.json({ error: "Only the coordinator link can do this." }, { status: 403 });

  if (b.action === "lock") meta.locked = true;
  else if (b.action === "unlock") {
    meta.locked = false;
    delete meta.decision;
  } else if (b.action === "decide") {
    if (!meta.locked) return NextResponse.json({ error: "Lock responses before choosing a trip." }, { status: 409 });
    if (!destById(b.destId) || !meta.windows.some((w) => w.id === b.windowId))
      return NextResponse.json({ error: "That option isn't part of this trip." }, { status: 400 });
    meta.decision = { destId: b.destId, windowId: b.windowId, at: new Date().toISOString() };
  } else if (b.action === "undecide") delete meta.decision;
  else return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  await setMeta(meta);
  return NextResponse.json({ ok: true, meta });
}
