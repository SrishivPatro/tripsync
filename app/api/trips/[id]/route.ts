import { NextResponse } from "next/server";
import { getMeta, getResponses, storageKind } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getMeta(id);
  if (!meta) return NextResponse.json({ error: "No trip found at this link." }, { status: 404 });
  const responses = await getResponses(id);
  return NextResponse.json({ meta, responses, storage: storageKind });
}
