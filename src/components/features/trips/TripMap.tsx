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

function flyToDay(map: any, mapboxgl: any, markers: MarkerDef[], center: [number, number]) {
  if (markers.length >= 2) {
    const bounds = new mapboxgl.LngLatBounds();
    markers.forEach((m) => bounds.extend([m.lng, m.lat]));
    map.fitBounds(bounds, { padding: 60, duration: 800 });
  } else if (markers.length === 1) {
    map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 13, duration: 800 });
  } else {
    map.flyTo({ center, zoom: 10, duration: 800 });
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
    const offset = filteredSaved.length + filteredActivities.length;
    const allFiltered = [
      ...filteredSaved.map((s, i) => ({ num: i + 1, label: s.title, lat: s.lat, lng: s.lng, color: "#C4664A" })),
      ...filteredActivities.map((a, i) => ({ num: filteredSaved.length + i + 1, label: a.title, lat: a.lat, lng: a.lng, color: "#2E7D52" })),
      ...filteredBookings.map((p, i) => ({ num: offset + i + 1, label: p.title, lat: p.latitude, lng: p.longitude, color: "#C4664A" })),
    ];
    addMarkersInternal(allFiltered);
    flyToDay(mapRef.current, mapboxRef.current, allFiltered, destCoords);
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
