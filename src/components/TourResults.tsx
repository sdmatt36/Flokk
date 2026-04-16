"use client";

import { useEffect, useRef } from "react";
import { Clock, MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

type Stop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  duration: number;
  why: string;
  familyNote: string;
};

type Props = {
  stops: Stop[];
  destinationCity: string;
  prompt: string;
};

export default function TourResults({ stops, destinationCity, prompt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (stops.length === 0 || !containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then((mb) => {
      if (destroyed || !containerRef.current) return;
      const mapboxgl = mb.default;
      mapboxgl.accessToken = token;

      const avgLat = stops.reduce((sum, s) => sum + s.lat, 0) / stops.length;
      const avgLng = stops.reduce((sum, s) => sum + s.lng, 0) / stops.length;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: [avgLng, avgLat],
        zoom: 13,
      });

      mapRef.current = map;

      // Add markers
      stops.forEach((stop, index) => {
        const el = document.createElement("div");
        el.style.cssText =
          `width:28px;height:28px;border-radius:50%;background:#C4664A;` +
          "display:flex;align-items:center;justify-content:center;" +
          "font-weight:700;font-size:12px;color:#fff;cursor:pointer;" +
          "box-shadow:0 2px 8px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
        el.textContent = String(index + 1);
        el.addEventListener("click", () => console.log(stop.name));

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
      });

      // Fit bounds to all stops
      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });

      // Draw route line on map load
      map.on("load", () => {
        map.addSource("tour-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: stops.map((s) => [s.lng, s.lat]),
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
  }, [stops]);

  return (
    <div>
      <p className="font-serif text-xl font-semibold text-[#1B3A5C] mb-1">{prompt}</p>
      <p className="text-sm text-gray-400 mb-6">{destinationCity}</p>

      {stops.length > 0 && (
        <div ref={containerRef} className="h-[280px] rounded-2xl overflow-hidden mb-6" />
      )}

      {stops.map((stop, index) => (
        <div key={index} className="border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm bg-white">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-[#C4664A] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {index + 1}
            </div>
            <span className="text-sm font-semibold text-[#1B3A5C] ml-3">{stop.name}</span>
          </div>

          <div className="flex items-center mt-2">
            <Clock size={12} className="text-gray-400" />
            <span className="text-xs text-gray-400 ml-1">{stop.duration} min</span>
          </div>

          {stop.address && (
            <div className="flex items-center mt-1">
              <MapPin size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400 ml-1">{stop.address}</span>
            </div>
          )}

          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{stop.why}</p>

          {stop.familyNote && (
            <p className="text-xs text-[#C4664A] mt-1 italic">{stop.familyNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}
