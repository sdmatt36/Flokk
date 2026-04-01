"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Map as MapIcon, ChevronLeft } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { getDestinationCoords } from "@/lib/destination-coords";

type MarkerDef = { num: number; label: string; lng: number; lat: number; color?: string };

function buildAppleMapsUrl(markers: MarkerDef[], center: [number, number]): string {
  if (markers.length === 0) return `https://maps.apple.com/?q=${center[1]},${center[0]}`;
  if (markers.length === 1) {
    return `https://maps.apple.com/?q=${markers[0].lat},${markers[0].lng}`;
  }
  const first = markers[0];
  const last = markers[markers.length - 1];
  return `https://maps.apple.com/?saddr=${first.lat},${first.lng}&daddr=${last.lat},${last.lng}`;
}

function buildGoogleMapsUrl(markers: MarkerDef[], center: [number, number]): string {
  if (markers.length === 0) return `https://www.google.com/maps/search/?api=1&query=${center[1]},${center[0]}`;
  if (markers.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${markers[0].lat},${markers[0].lng}`;
  }
  const origin = `${markers[0].lat},${markers[0].lng}`;
  const dest = `${markers[markers.length - 1].lat},${markers[markers.length - 1].lng}`;
  const waypoints = markers.slice(1, -1).map((m) => `${m.lat},${m.lng}`).join("|");
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

function createMarkerEl(m: MarkerDef): HTMLElement {
  const color = m.color ?? "#C4664A";
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:default;";

  const pin = document.createElement("div");
  pin.style.cssText =
    `width:32px;height:32px;border-radius:50%;background:${color};border:2px solid ${color};` +
    "display:flex;align-items:center;justify-content:center;" +
    "font-weight:700;font-size:13px;color:#fff;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
  pin.textContent = String(m.num);

  const lbl = document.createElement("div");
  lbl.style.cssText =
    "margin-top:4px;background:#fff;border-radius:999px;padding:2px 8px;" +
    "font-size:10px;font-weight:600;color:#333;white-space:nowrap;" +
    "box-shadow:0 1px 4px rgba(0,0,0,0.15);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
  lbl.textContent = m.label;

  wrap.appendChild(pin);
  wrap.appendChild(lbl);
  return wrap;
}

// Known city centers [lat, lng] — used as bounds anchor, prevents (0,0) fallback
const CITY_CENTERS: Record<string, [number, number]> = {
  "Tokyo": [35.6762, 139.6503],
  "Kyoto": [35.0116, 135.7681],
  "Osaka": [34.6937, 135.5023],
  "Nara": [34.6851, 135.8048],
  "Hiroshima": [34.3853, 132.4553],
  "Sapporo": [43.0618, 141.3545],
  "Fukuoka": [33.5904, 130.4017],
  "Okinawa": [26.2124, 127.6809],
  "Seoul": [37.5665, 126.9780],
  "Busan": [35.1796, 129.0756],
  "Bangkok": [13.7563, 100.5018],
  "Chiang Mai": [18.7883, 98.9853],
  "Singapore": [1.3521, 103.8198],
  "Bali": [-8.3405, 115.0920],
  "Jakarta": [-6.2088, 106.8456],
  "Kuala Lumpur": [3.1390, 101.6869],
  "Ho Chi Minh City": [10.8231, 106.6297],
  "Hanoi": [21.0285, 105.8542],
  "Hong Kong": [22.3193, 114.1694],
  "Taipei": [25.0320, 121.5654],
  "Shanghai": [31.2304, 121.4737],
  "Beijing": [39.9042, 116.4074],
  "Sydney": [-33.8688, 151.2093],
  "Melbourne": [-37.8136, 144.9631],
  "Auckland": [-36.8485, 174.7633],
  "Dubai": [25.2048, 55.2708],
  "Paris": [48.8566, 2.3522],
  "London": [51.5074, -0.1278],
  "Rome": [41.9028, 12.4964],
  "Barcelona": [41.3851, 2.1734],
  "Amsterdam": [52.3676, 4.9041],
  "Berlin": [52.5200, 13.4050],
  "Lisbon": [38.7169, -9.1399],
  "Madrid": [40.4168, -3.7038],
  "Marrakesh": [31.6295, -7.9811],
  "Montreal": [45.5017, -73.5673],
  "Sri Lanka": [7.8731, 80.7718],
  "New York": [40.7128, -74.0060],
  "Los Angeles": [34.0522, -118.2437],
  "San Francisco": [37.7749, -122.4194],
  "Chicago": [41.8781, -87.6298],
  "Miami": [25.7617, -80.1918],
  "Honolulu": [21.3069, -157.8583],
  "Cancun": [21.1619, -86.8515],
  "Mexico City": [19.4326, -99.1332],
  "Buenos Aires": [-34.6037, -58.3816],
  "Rio de Janeiro": [-22.9068, -43.1729],
};

// Rejects null, zero, non-number, and out-of-range coordinates
function isValidCoord(lat: any, lng: any): boolean {
  return lat != null && lng != null &&
    typeof lat === "number" && typeof lng === "number" &&
    lat !== 0 && lng !== 0 &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
}

function isWithinTripRadius(lat: number, lng: number, anchorLat: number, anchorLng: number, radiusKm = 300): boolean {
  const R = 6371;
  const dLat = ((lat - anchorLat) * Math.PI) / 180;
  const dLng = ((lng - anchorLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((anchorLat * Math.PI) / 180) *
    Math.cos((lat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= radiusKm;
}


type MapSavedItem = { title: string; lat: number; lng: number; dayIndex?: number | null };
type ImportedBookingPin = { id: string; title: string; type: string; dayIndex: number | null; latitude: number; longitude: number };

export function TripMap({ activeDay, flyTarget, onFlyTargetConsumed, tripId, destinationCity, destinationCountry, savedItems = [], activities = [], importedBookingPins = [] }: { activeDay: number | null; flyTarget?: { lat: number; lng: number } | null; onFlyTargetConsumed?: () => void; tripId?: string; destinationCity?: string | null; destinationCountry?: string | null; savedItems?: MapSavedItem[]; activities?: MapSavedItem[]; importedBookingPins?: ImportedBookingPin[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapboxRef = useRef<any>(null);
  // mapReady as state (not ref) so map load triggers a re-render and re-runs the marker effect
  const [mapReady, setMapReady] = useState(false);
  const [toast, setToast] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<MapSavedItem[]>([]);

  const destCoords = getDestinationCoords(destinationCity, destinationCountry);

  // Fuzzy-match destinationCity against CITY_CENTERS to get a reliable anchor.
  // Falls back to CITY_CENTERS default (Seoul) rather than (0,0) from destCoords.
  const cityKey = Object.keys(CITY_CENTERS).find(k =>
    destinationCity?.toLowerCase().includes(k.toLowerCase())
  ) ?? "";
  const cityCenterFallback = CITY_CENTERS[cityKey] ?? [37.5665, 126.9780]; // Seoul if all else fails
  const anchorLat = cityCenterFallback[0];
  const anchorLng = cityCenterFallback[1];

  // Fetch saves with coordinates for this trip
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/saves?tripId=${tripId}&public=true`)
      .then((r) => r.json())
      .then((data: { saves?: Array<{ rawTitle?: string | null; lat?: number | null; lng?: number | null; dayIndex?: number | null }> }) => {
        const items: MapSavedItem[] = (data.saves ?? [])
          .filter((s) => s.lat != null && s.lng != null)
          .map((s) => ({ title: s.rawTitle ?? "Save", lat: s.lat!, lng: s.lng!, dayIndex: s.dayIndex }));
        setFetchedItems(items);
      })
      .catch(() => {});
  }, [tripId]);

  // Merge prop savedItems and fetched items, dedup by coords
  const allSavedItems = (() => {
    const merged = [...savedItems];
    for (const fi of fetchedItems) {
      const dup = merged.some((m) => Math.abs(m.lat - fi.lat) < 0.0001 && Math.abs(m.lng - fi.lng) < 0.0001);
      if (!dup) merged.push(fi);
    }
    return merged;
  })();

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then((mb) => {
      if (destroyed || !containerRef.current) return;
      const mapboxgl = mb.default;
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [anchorLng, anchorLat], // use computed anchor, not raw destCoords
        zoom: 12,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (!destroyed) {
          map.resize();
          map.flyTo({ center: [anchorLng, anchorLat], zoom: 12, duration: 0 });
          // setMapReady triggers a re-render so the marker effect runs with up-to-date data
          setMapReady(true);
        }
      });
    });

    return () => {
      destroyed = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize map when container dimensions change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Respond to day changes — rebuild markers whenever day, data, or map readiness changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapboxRef.current) return;
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;

    // Build day-filtered source lists
    let dayItems: MapSavedItem[];
    let dayActivities: typeof activities;
    let dayBookings: typeof importedBookingPins;

    if (activeDay !== null) {
      dayItems = allSavedItems.filter(
        s => s.dayIndex != null && (s.dayIndex === activeDay || (s as any).day_index === activeDay)
      );
      dayActivities = activities.filter(a => a.dayIndex != null && a.dayIndex === activeDay);
      dayBookings = importedBookingPins.filter(
        p => p.dayIndex != null && p.dayIndex === activeDay
      );
    } else {
      dayItems = allSavedItems;
      dayActivities = activities;
      dayBookings = importedBookingPins;
    }

    // ARRAY 1: pinsToRender — isValidCoord only. ALL of these get markers on the map.
    const validSaved = dayItems.filter(s => isValidCoord(s.lat, s.lng));
    const validActivities = dayActivities.filter(a => isValidCoord(a.lat, a.lng));
    const validBookings = dayBookings.filter(p => isValidCoord(p.latitude, p.longitude));
    const offset = validSaved.length + validActivities.length;
    const pinsToRender: MarkerDef[] = [
      ...validSaved.map((s, i) => ({ num: i + 1, label: s.title, lat: s.lat, lng: s.lng, color: "#C4664A" as const })),
      ...validActivities.map((a, i) => ({ num: validSaved.length + i + 1, label: a.title, lat: a.lat, lng: a.lng, color: "#2E7D52" as const })),
      ...validBookings.map((p, i) => ({ num: offset + i + 1, label: p.title, lat: p.latitude, lng: p.longitude, color: "#C4664A" as const })),
    ];

    // Render all valid-coord pins — no proximity filter, no anchor, just isValidCoord
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    pinsToRender.forEach((m) => {
      const marker = new mapboxgl.Marker({ element: createMarkerEl(m), anchor: "top" })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // Viewport: fit all valid pins for this day, no proximity filtering
    if (pinsToRender.length === 0) {
      // No pins — fly to trip anchor (accommodation or city center)
      map.flyTo({ center: [anchorLng, anchorLat], zoom: 12, duration: 800 });
    } else if (pinsToRender.length === 1) {
      map.flyTo({ center: [pinsToRender[0].lng, pinsToRender[0].lat], zoom: 14, duration: 800 });
    } else {
      // 2+ pins — fitBounds; if span > 3° (e.g. Seoul+Busan), zoom to first item at city level
      const lats = pinsToRender.map(p => p.lat);
      const lngs = pinsToRender.map(p => p.lng);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);
      if (latSpan > 3 || lngSpan > 3) {
        map.flyTo({ center: [pinsToRender[0].lng, pinsToRender[0].lat], zoom: 12, duration: 800 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        pinsToRender.forEach(m => bounds.extend([m.lng, m.lat]));
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
      }
    }
  }, [activeDay, allSavedItems, activities, importedBookingPins, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to a specific coordinate when flyTarget is set
  useEffect(() => {
    if (!flyTarget || !mapRef.current || !mapReady) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 14, duration: 800 });
    onFlyTargetConsumed?.();
  }, [flyTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  function getActiveMarkers(): MarkerDef[] {
    const filteredSaved = activeDay !== null ? allSavedItems.filter(s => s.dayIndex === activeDay) : allSavedItems;
    const filteredActs = activeDay !== null ? activities.filter(a => a.dayIndex === activeDay) : activities;
    const filteredBookings = (activeDay !== null
      ? importedBookingPins.filter(p => p.dayIndex === activeDay)
      : importedBookingPins
    ).filter(p => p.latitude !== 0 && p.longitude !== 0);
    const offset = filteredSaved.length + filteredActs.length;
    return [
      ...filteredSaved.map((s, i) => ({ num: i + 1, label: s.title, lat: s.lat, lng: s.lng, color: "#C4664A" })),
      ...filteredActs.map((a, i) => ({ num: filteredSaved.length + i + 1, label: a.title, lat: a.lat, lng: a.lng, color: "#2E7D52" })),
      ...filteredBookings.map((p, i) => ({ num: offset + i + 1, label: p.title, lat: p.latitude, lng: p.longitude, color: "#C4664A" })),
    ];
  }

  function handleOpenAppleMaps() {
    window.open(buildAppleMapsUrl(getActiveMarkers(), destCoords), "_blank", "noopener");
  }

  function handleOpenGoogleMaps() {
    window.open(buildGoogleMapsUrl(getActiveMarkers(), destCoords), "_blank", "noopener");
  }

  async function handleShare() {
    const url = buildGoogleMapsUrl(getActiveMarkers(), destCoords);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API not available — silently skip
    }
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  return (
    <div style={{ height: "100%", borderRadius: "16px", overflow: "hidden", background: "#F5F5F5", display: "flex", flexDirection: "column" }}>

      {/* Map container — flex:1 + minHeight:0 lets it fill without overflowing */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* Back button */}
        <button
          onClick={() => tripId ? router.push(`/trips/${tripId}`) : router.back()}
          style={{
            position: "absolute", top: "12px", left: "12px", zIndex: 10,
            display: "flex", alignItems: "center", gap: "4px",
            backgroundColor: "#fff", border: "none", borderRadius: "999px",
            padding: "7px 12px 7px 8px",
            fontSize: "13px", fontWeight: 600, color: "#1a1a1a",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)", cursor: "pointer",
          }}
        >
          <ChevronLeft size={16} strokeWidth={2.5} style={{ color: "#1a1a1a" }} />
          Back
        </button>

        {toast && (
          <div style={{
            position: "absolute", top: "12px", left: "50%", transform: "translateX(-50%)",
            backgroundColor: "#1a1a1a", color: "#fff", fontSize: "12px", fontWeight: 600,
            padding: "6px 14px", borderRadius: "999px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 10, whiteSpace: "nowrap", pointerEvents: "none",
          }}>
            Copied!
          </div>
        )}
      </div>

      {/* Bottom action strip — flexShrink:0 pins it to the bottom */}
      <div style={{ flexShrink: 0, padding: "12px", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleOpenAppleMaps}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "999px", padding: "9px 12px", fontSize: "12px", color: "#333", cursor: "pointer" }}
          >
            <MapIcon size={13} style={{ color: "#C4664A" }} />
            Apple Maps
          </button>
          <button
            onClick={handleOpenGoogleMaps}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "999px", padding: "9px 12px", fontSize: "12px", color: "#333", cursor: "pointer" }}
          >
            <MapIcon size={13} style={{ color: "#C4664A" }} />
            Google Maps
          </button>
        </div>
        <button
          onClick={handleShare}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", backgroundColor: "#C4664A", border: "none", borderRadius: "999px", padding: "10px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", cursor: "pointer" }}
        >
          <Share2 size={14} style={{ color: "#fff" }} />
          Share route
        </button>
      </div>

    </div>
  );
}
