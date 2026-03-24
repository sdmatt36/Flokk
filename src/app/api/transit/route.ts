import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchDirections(origin: string, destination: string, mode: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json(null, { status: 401 });
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("[transit] No API key configured");
    return NextResponse.json(null);
  }

  const { originLat, originLng, destLat, destLng } = await req.json() as {
    originLat: number; originLng: number; destLat: number; destLng: number;
  };

  if (!originLat || !originLng || !destLat || !destLng) return NextResponse.json(null);

  const origin = `${originLat},${originLng}`;
  const destination = `${destLat},${destLng}`;
  const distKm = haversineKm(originLat, originLng, destLat, destLng);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`;

  console.log("[transit] request:", { origin, destination, distKm: distKm.toFixed(2) });

  try {
    // Try transit first (unless very short distance)
    if (distKm >= 0.5) {
      const data = await fetchDirections(origin, destination, "transit");
      console.log("[transit] transit status:", data.status, data.error_message ? `— ${data.error_message}` : "");
      if (data.status === "OK" && data.routes?.[0]?.legs?.[0]) {
        const leg = data.routes[0].legs[0];
        const duration = leg.duration?.text ?? "";

        // Find the primary transit step
        const transitStep = leg.steps?.find((s: { travel_mode: string }) => s.travel_mode === "TRANSIT");
        const vehicle = transitStep?.transit_details?.line?.vehicle?.name ?? "Transit";
        const fare = data.routes[0].fare?.text ?? null;

        console.log("[transit] returning:", { mode: vehicle, duration, cost: fare });
        return NextResponse.json({
          mode: vehicle,
          duration,
          cost: fare,
          directionsUrl,
        });
      }
    }

    // Walking fallback
    const walkData = await fetchDirections(origin, destination, "walking");
    console.log("[transit] walking status:", walkData.status, walkData.error_message ? `— ${walkData.error_message}` : "");
    if (walkData.status === "OK" && walkData.routes?.[0]?.legs?.[0]) {
      const leg = walkData.routes[0].legs[0];
      const result = {
        mode: "Walk",
        duration: leg.duration?.text ?? "",
        cost: null,
        directionsUrl: directionsUrl.replace("travelmode=transit", "travelmode=walking"),
      };
      console.log("[transit] returning walk:", result);
      return NextResponse.json(result);
    }
  } catch (err) {
    console.error("[transit] Directions API error:", err);
  }

  console.log("[transit] no route found, returning null");
  return NextResponse.json(null);
}
