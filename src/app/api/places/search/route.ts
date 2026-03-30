import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || q.trim().length < 3) return NextResponse.json({ places: [] });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
        `input=${encodeURIComponent(q)}&inputtype=textquery&` +
        `fields=place_id,name,formatted_address,geometry,photos,types&` +
        `key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = (await res.json()) as { status: string; candidates?: unknown[] };
    return NextResponse.json({ places: data.candidates ?? [] });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
