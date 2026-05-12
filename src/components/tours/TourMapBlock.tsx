"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

type MapStop = { name: string; lat: number | null; lng: number | null };

interface TourMapBlockProps {
  stops: MapStop[];
}

export default function TourMapBlock({ stops }: TourMapBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  const hasValid = stops.some((s) => s.lat && s.lng);

  useEffect(() => {
    const validStops = stops.filter(
      (s): s is MapStop & { lat: number; lng: number } => !!(s.lat && s.lng)
    );
    if (validStops.length === 0 || !containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then((mb) => {
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

      validStops.forEach((stop, index) => {
        const el = document.createElement("div");
        el.style.cssText =
          "width:28px;height:28px;border-radius:50%;background:#C4664A;" +
          "display:flex;align-items:center;justify-content:center;" +
          "font-weight:700;font-size:12px;color:#fff;cursor:pointer;" +
          "box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
        el.textContent = String(index + 1);
        el.addEventListener("click", () => console.log(stop.name));

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
      });

      const bounds = new mapboxgl.LngLatBounds();
      validStops.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });

      map.on("load", () => {
        map.addSource("tour-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: validStops.map((s) => [s.lng, s.lat]),
            },
            properties: {},
          },
        });

        map.addLayer({
          id: "tour-route-line",
          type: "line",
          source: "tour-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1B3A5C", "line-width": 2, "line-opacity": 0.6 },
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
  }, [stops]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasValid) return null;

  return <div ref={containerRef} className="h-[280px] rounded-2xl overflow-hidden mb-6" />;
}
