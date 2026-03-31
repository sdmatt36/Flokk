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

// Known city centers [lat, lng] — used to filter out-of-region stray pins from fitBounds
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

function isValidCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null && lat !== 0 && lng !== 0 &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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

// destCoords is [lng, lat] (Mapbox convention)
function flyToDay(map: any, mapboxgl: any, markers: MarkerDef[], center: [number, number], anchorLat: number, anchorLng: number) {
  // Apply both coord validity AND proximity filter for bounds — but never affect which pins are rendered
  const inBounds = markers.filter(
    (m) => isValidCoord(m.lat, m.lng) && isWithinTripRadius(m.lat, m.lng, anchorLat, anchorLng)
  );
  if (inBounds.length >= 2) {
    const bounds = new mapboxgl.LngLatBounds();
    inBounds.forEach((m) => bounds.extend([m.lng, m.lat]));
    map.fitBounds(bounds, { padding: 60, duration: 800 });
  } else if (inBounds.length === 1) {
    map.flyTo({ center: [inBounds[0].lng, inBounds[0].lat], zoom: 13, duration: 800 });
  } else {
    map.flyTo({ center: [anchorLng, anchorLat], zoom: 12, duration: 800 });
  }
}

type MapSavedItem = { title: string; lat: number; lng: number; dayIndex?: number | null };
type ImportedBookingPin = { id: string; title: string; type: string; dayIndex: number | null; latitude: number; longitude: number };

export function TripMap({ activeDay, flyTarget, onFlyTargetConsumed, tripId, destinationCity, destinationCountry, savedItems = [], activities = [], importedBookingPins = [] }: { activeDay: number | null; flyTarget?: { lat: number; lng: number } | null; onFlyTargetConsumed?: () => void; tripId?: string; destinationCity?: string | null; destinationCountry?: string | null; savedItems?: MapSavedItem[]; activities?: MapSavedItem[]; importedBookingPins?: ImportedBookingPin[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapboxRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const [toast, setToast] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<MapSavedItem[]>([]);

  const destCoords = getDestinationCoords(destinationCity, destinationCountry);

  // Fuzzy-match destinationCity against CITY_CENTERS keys (handles "Seoul, South Korea" → "Seoul")
  const cityKey = Object.keys(CITY_CENTERS).find(k =>
    destinationCity?.toLowerCase().includes(k.toLowerCase())
  ) ?? "";
  const fallbackCenter = CITY_CENTERS[cityKey] ?? ([destCoords[1], destCoords[0]] as [number, number]);
  const anchorLat = fallbackCenter[0];
  const anchorLng = fallbackCenter[1];

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
        center: destCoords,
        zoom: 12,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (!destroyed) {
          initializedRef.current = true;
          map.resize();
          // Center on destination immediately; markers will be added by the effect below
          map.flyTo({ center: destCoords, zoom: 12, duration: 0 });
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
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize map when container dimensions change (panel height syncs via ResizeObserver)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Respond to day changes — show pins for items on that day only
  useEffect(() => {
    if (!initializedRef.current || !mapRef.current) return;
    let filteredSaved: typeof allSavedItems;
    let filteredActivities: typeof activities;
    let filteredBookings: typeof importedBookingPins;
    if (activeDay !== null) {
      // Strict match: only show items whose dayIndex equals the active day.
      // Items with null/undefined dayIndex are excluded — never shown as a fallback.
      filteredSaved = allSavedItems.filter(
        s => s.dayIndex != null && (s.dayIndex === activeDay || (s as any).day_index === activeDay)
      );
      filteredActivities = activities.filter(a => a.dayIndex != null && a.dayIndex === activeDay);
      filteredBookings = importedBookingPins.filter(
        p => p.dayIndex != null && p.dayIndex === activeDay && p.latitude !== 0 && p.longitude !== 0
      );
    } else {
      filteredSaved = allSavedItems;
      filteredActivities = activities;
      filteredBookings = importedBookingPins.filter(p => p.latitude !== 0 && p.longitude !== 0);
    }
    const validSaved = filteredSaved.filter(s => isValidCoord(s.lat, s.lng));
    const validActivities = filteredActivities.filter(a => isValidCoord(a.lat, a.lng));
    const validBookings = filteredBookings.filter(p => isValidCoord(p.latitude, p.longitude));
    const offset = validSaved.length + validActivities.length;
    const allFiltered = [
      ...validSaved.map((s, i) => ({ num: i + 1, label: s.title, lat: s.lat, lng: s.lng, color: "#C4664A" })),
      ...validActivities.map((a, i) => ({ num: validSaved.length + i + 1, label: a.title, lat: a.lat, lng: a.lng, color: "#2E7D52" })),
      ...validBookings.map((p, i) => ({ num: offset + i + 1, label: p.title, lat: p.latitude, lng: p.longitude, color: "#C4664A" })),
    ];
    addMarkersInternal(allFiltered);
    flyToDay(mapRef.current, mapboxRef.current, allFiltered, destCoords, anchorLat, anchorLng);
  }, [activeDay, allSavedItems, activities, importedBookingPins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to a specific coordinate when flyTarget is set
  useEffect(() => {
    if (!flyTarget || !mapRef.current || !initializedRef.current) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 14, duration: 800 });
    onFlyTargetConsumed?.();
  }, [flyTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  function addMarkersInternal(markers: MarkerDef[]) {
    const mapboxgl = mapboxRef.current;
    const map = mapRef.current;
    if (!mapboxgl || !map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((m) => {
      const marker = new mapboxgl.Marker({ element: createMarkerEl(m), anchor: "top" })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }

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
