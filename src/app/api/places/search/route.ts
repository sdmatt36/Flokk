import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

type PlaceCandidate = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
  types?: string[];
};

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const city = searchParams.get("city");
  if (!q || q.trim().length < 3) return NextResponse.json({ places: [] });

  const query = city?.trim() ? `${q.trim()} ${city.trim()}` : q.trim();

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
        `input=${encodeURIComponent(query)}&inputtype=textquery&` +
        `fields=place_id,name,formatted_address,geometry,photos,types&` +
        `key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = (await res.json()) as { status: string; candidates?: PlaceCandidate[] };
    const candidates = data.candidates ?? [];
    const places = candidates.map(c => ({
      ...c,
      photoUrl: c.photos?.[0]?.photo_reference
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${c.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        : null,
    }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
