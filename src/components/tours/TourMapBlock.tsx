"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

type MapStop = { name: string; lat: number | null; lng: number | null };

interface TourMapBlockProps {
  stops: MapStop[];
  transport?: string;
}

function transportToProfile(transport: string | undefined): "walking" | "driving" {
  if (!transport) return "walking";
  if (transport === "Walking") return "walking";
  return "driving";
}

async function fetchRoutedGeometry(
  validStops: Array<{ lat: number; lng: number }>,
  profile: "walking" | "driving",
  token: string
): Promise<[number, number][] | null> {
  if (validStops.length < 2) return null;
  // Mapbox Directions max 25 waypoints
  const coords = validStops.map(s => `${s.lng},${s.lat}`).join(";");
  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
    };
    return data.routes?.[0]?.geometry?.coordinates ?? null;
  } catch {
    return null;
  }
}

export default function TourMapBlock({ stops, transport }: TourMapBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [routeUrl, setRouteUrl] = useState<string | null>(null);

  const validStops = stops.filter(
    (s): s is MapStop & { lat: number; lng: number } => !!(s.lat && s.lng)
  );
  const hasValid = validStops.length > 0;

  // Build Google Maps full-route URL
  useEffect(() => {
    if (validStops.length < 2) { setRouteUrl(null); return; }
    const travelMode = transport === "Walking" ? "walking" : transport === "Metro / Transit" ? "transit" : "driving";
    const origin = `${validStops[0].lat},${validStops[0].lng}`;
    const destination = `${validStops[validStops.length - 1].lat},${validStops[validStops.length - 1].lng}`;
    const waypoints = validStops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|");
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=${travelMode}`;
    setRouteUrl(url);
  }, [stops, transport]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (validStops.length === 0 || !containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then(async (mb) => {
      if (destroyed || !containerRef.current) return;
      const mapboxgl = mb.default;
      mapboxgl.accessToken = token;

      const avgLat = validStops.reduce((sum, s) => sum + s.lat, 0) / validStops.length;
      const avgLng = validStops.reduce((sum, s) => sum + s.lng, 0) / validStops.length;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [avgLng, avgLat],
        zoom: 13,
      });

      mapRef.current = map;

      // Fetch routed geometry
      const profile = transportToProfile(transport);
      const routeCoords = await fetchRoutedGeometry(validStops, profile, token);

      if (destroyed) return;

      // Add numbered markers with name popup
      validStops.forEach((stop, index) => {
        const el = document.createElement("div");
        el.style.cssText =
          "width:28px;height:28px;border-radius:50%;background:#C4664A;" +
          "display:flex;align-items:center;justify-content:center;" +
          "font-weight:700;font-size:12px;color:#fff;cursor:pointer;" +
          "box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
        el.textContent = String(index + 1);

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false, closeOnClick: false })
          .setText(stop.name);

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("mouseenter", () => marker.getPopup()?.addTo(map));
        el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
        el.addEventListener("click", () => {
          if (marker.getPopup()?.isOpen()) marker.getPopup()?.remove();
          else marker.getPopup()?.addTo(map);
        });
      });

      const bounds = new mapboxgl.LngLatBounds();
      validStops.forEach(s => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });

      map.on("load", () => {
        if (destroyed) return;
        const lineCoords: [number, number][] = routeCoords ?? validStops.map(s => [s.lng, s.lat]);

        map.addSource("tour-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: lineCoords },
            properties: {},
          },
        });

        // Subtle casing for contrast against map backgrounds
        map.addLayer({
          id: "tour-route-casing",
          type: "line",
          source: "tour-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#fff", "line-width": 5, "line-opacity": 0.6 },
        });

        map.addLayer({
          id: "tour-route-line",
          type: "line",
          source: "tour-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1B3A5C", "line-width": 3, "line-opacity": 0.85 },
        });
      });
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stops, transport]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasValid) return null;

  return (
    <div className="mb-6">
      <div ref={containerRef} className="h-[280px] rounded-2xl overflow-hidden" />
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-2 text-xs font-medium text-[#1B3A5C] hover:text-[#C4664A] transition-colors"
        >
          Open full route in Google Maps →
        </a>
      )}
    </div>
  );
}
