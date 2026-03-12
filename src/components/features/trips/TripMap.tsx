"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Map as MapIcon } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

type MarkerDef = { num: number; label: string; lng: number; lat: number };
type DayDef = { markers: MarkerDef[] };

// Corrected Okinawa trip pin data — replace with dynamic trip data in Phase 2
const DAY_DATA: DayDef[] = [
  {
    markers: [
      { num: 1, label: "Naha Airport",   lng: 127.6461, lat: 26.1958 },
      { num: 2, label: "Halekulani",     lng: 127.8574, lat: 26.4969 },
      { num: 3, label: "Kokusai-dori",   lng: 127.6809, lat: 26.2124 },
    ],
  },
  {
    markers: [
      { num: 1, label: "Katsuren Castle", lng: 127.8611, lat: 26.3267 },
    ],
  },
  { markers: [] },
  { markers: [] },
  {
    markers: [
      { num: 1, label: "Halekulani", lng: 127.8574, lat: 26.4969 },
    ],
  },
];

const OKINAWA_CENTER: [number, number] = [127.6809, 26.2124];

function buildAppleMapsUrl(markers: MarkerDef[]): string {
  if (markers.length === 0) return "https://maps.apple.com";
  if (markers.length === 1) {
    return `https://maps.apple.com/?q=${markers[0].lat},${markers[0].lng}`;
  }
  const first = markers[0];
  const last = markers[markers.length - 1];
  return `https://maps.apple.com/?saddr=${first.lat},${first.lng}&daddr=${last.lat},${last.lng}`;
}

function buildGoogleMapsUrl(markers: MarkerDef[]): string {
  if (markers.length === 0) return "https://www.google.com/maps";
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
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:default;";

  const pin = document.createElement("div");
  pin.style.cssText =
    "width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #C4664A;" +
    "display:flex;align-items:center;justify-content:center;" +
    "font-weight:700;font-size:13px;color:#C4664A;" +
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

function flyToDay(map: any, mapboxgl: any, markers: MarkerDef[]) {
  if (markers.length >= 2) {
    const bounds = new mapboxgl.LngLatBounds();
    markers.forEach((m) => bounds.extend([m.lng, m.lat]));
    map.fitBounds(bounds, { padding: 60, duration: 800 });
  } else if (markers.length === 1) {
    map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 13, duration: 800 });
  } else {
    map.flyTo({ center: OKINAWA_CENTER, zoom: 10, duration: 800 });
  }
}

export function TripMap({ activeDay, flyTarget, onFlyTargetConsumed }: { activeDay: number; flyTarget?: { lat: number; lng: number } | null; onFlyTargetConsumed?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapboxRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const [toast, setToast] = useState(false);

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
        center: OKINAWA_CENTER,
        zoom: 10,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (!destroyed) {
          const day = DAY_DATA[0];
          addMarkersInternal(day.markers);
          flyToDay(map, mapboxgl, day.markers);
          initializedRef.current = true;
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
  }, []);

  // Respond to day changes driven by parent
  useEffect(() => {
    if (!initializedRef.current || !mapRef.current) return;
    const day = DAY_DATA[activeDay];
    addMarkersInternal(day.markers);
    flyToDay(mapRef.current, mapboxRef.current, day.markers);
  }, [activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleOpenAppleMaps() {
    window.open(buildAppleMapsUrl(DAY_DATA[activeDay].markers), "_blank", "noopener");
  }

  function handleOpenGoogleMaps() {
    window.open(buildGoogleMapsUrl(DAY_DATA[activeDay].markers), "_blank", "noopener");
  }

  async function handleShare() {
    const url = buildGoogleMapsUrl(DAY_DATA[activeDay].markers);
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
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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
