import { NextResponse } from "next/server";
import { runXLayerIndexer } from "@/lib/server/xlayerIndexer";

export const dynamic = "force-dynamic";
// Next.js reads this as static segment config, so it has to be a literal.
export const maxDuration = 60;

/**
 * GET /api/indexer/xlayer: one indexer run, called by Vercel Cron (vercel.json) or by hand.
 * Requires `Authorization: Bearer <CRON_SECRET>`, which is what Vercel Cron sends.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // Leave a quarter of the function's time for the final metrics refresh and the response.
    const result = await runXLayerIndexer(maxDuration * 750);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[xlayer-indexer] run failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "indexer failed" }, { status: 500 });
  }
}
