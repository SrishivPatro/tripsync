import { NextResponse } from "next/server";
import { geminiKey } from "@/lib/gemini";
import { pingStore, storageKind } from "@/lib/store";

export const dynamic = "force-dynamic";

// Open /api/health after deploying to check the database and Gemini are wired up.
export async function GET() {
  let database = "ok";
  try { await pingStore(); } catch (e) { database = (e as Error).message; }
  return NextResponse.json({ storage: storageKind, database, gemini: geminiKey() ? "key set" : "GEMINI_API_KEY missing" });
}
