import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Placeholder — trip lifecycle logic goes here when needed.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: implement trip lifecycle actions (e.g. auto-archive past trips)
  return NextResponse.json({ status: "ok" });
}
