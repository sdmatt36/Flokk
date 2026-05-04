"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const STOPS = [
  { lng: 139.7707, lat: 35.6654, num: 1, primary: true,  title: "Tsukiji Outer Market", subtitle: "8:00 AM · breakfast",  familyPro: false, labelSide: "right" },
  { lng: 139.7634, lat: 35.6597, num: 2, primary: false, title: "Hama-rikyu Gardens",   subtitle: "10:30 AM · stroll",   familyPro: false, labelSide: "left"  },
  { lng: 139.7649, lat: 35.6720, num: 3, primary: false, title: "Ginza food halls",     subtitle: "12:00 PM · lunch",    familyPro: false, labelSide: "right" },
  { lng: 139.7665, lat: 35.6800, num: 4, primary: false, title: "Poop break",           subtitle: "1:15 PM · family-pro",familyPro: true,  labelSide: "right" },
  { lng: 139.7574, lat: 35.6852, num: 5, primary: false, title: "Imperial Palace",      subtitle: "2:30 PM · culture",   familyPro: false, labelSide: "left"  },
  { lng: 139.7731, lat: 35.6984, num: 6, primary: false, title: "Akihabara",            subtitle: "4:00 PM · stop",      familyPro: false, labelSide: "right" },
  { lng: 139.7741, lat: 35.7148, num: 7, primary: false, title: "",                     subtitle: "",                    familyPro: false, labelSide: "right" },
  { lng: 139.7967, lat: 35.7148, num: 8, primary: true,  title: "Senso-ji + ramen",     subtitle: "5:30 PM · finale",    familyPro: false, labelSide: "right" },
] as const;

const ROUTE_COORDS = STOPS.map((s) => [s.lng, s.lat]);

function createMarkerEl(stop: (typeof STOPS)[number]): HTMLElement {
  const size = stop.primary ? 40 : 28;

  // Wrapper is circle-sized so anchor:'center' centers the circle on the coordinate.
  // Label is absolutely positioned to the right, outside wrapper bounds.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:relative;width:${size}px;height:${size}px;`;

  const circle = document.createElement("div");
  if (stop.primary) {
    circle.style.cssText =
      `width:${size}px;height:${size}px;border-radius:50%;background:#C4664A;` +
      `border:3px solid white;display:flex;align-items:center;justify-content:center;` +
      `font-weight:700;font-size:14px;color:white;` +
      `font-family:'DM Sans',system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.28);`;
  } else {
    circle.style.cssText =
      `width:${size}px;height:${size}px;border-radius:50%;background:white;` +
      `border:3px solid #C4664A;display:flex;align-items:center;justify-content:center;` +
      `font-weight:700;font-size:11px;color:#C4664A;` +
      `font-family:'DM Sans',system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.15);`;
  }
  circle.textContent = String(stop.num);
  wrapper.appendChild(circle);

  if (stop.title) {
    const borderColor = stop.familyPro ? "#C4664A" : "#E0E0E0";
    const borderWidth = stop.familyPro ? "1.5px" : "1px";
    const labelGap = 8;
    const labelPositionStyle = stop.labelSide === "left"
      ? `right:${size + labelGap}px;`
      : `left:${size + labelGap}px;`;
    const label = document.createElement("div");
    label.style.cssText =
      `position:absolute;${labelPositionStyle}top:50%;transform:translateY(-50%);` +
      `background:white;border:${borderWidth} solid ${borderColor};border-radius:6px;` +
      `padding:6px 10px;box-shadow:0 1px 3px rgba(0,0,0,0.12);white-space:nowrap;pointer-events:none;`;

    const titleEl = document.createElement("div");
    titleEl.style.cssText =
      `font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:600;` +
      `color:#1B3A5C;line-height:1.3;`;
    titleEl.textContent = stop.title;

    const subtitleEl = document.createElement("div");
    subtitleEl.style.cssText =
      `font-family:'DM Sans',system-ui,sans-serif;font-size:9px;` +
      `color:${stop.familyPro ? "#C4664A" : "#888888"};margin-top:1px;line-height:1.3;`;
    subtitleEl.textContent = stop.subtitle;

    label.appendChild(titleEl);
    label.appendChild(subtitleEl);
    wrapper.appendChild(label);
  }

  return wrapper;
}

export default function BuildATourHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || token.startsWith("pk.placeholder")) return;

    let destroyed = false;

    import("mapbox-gl").then((mb) => {
      if (destroyed || !containerRef.current) return;
      const mapboxgl = mb.default;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        interactive: false,
        attributionControl: false,
      });

      mapRef.current = map;

      // Markers: circle centered on coordinate, label floats right via absolute positioning
      STOPS.forEach((stop) => {
        new mapboxgl.Marker({ element: createMarkerEl(stop), anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
      });

      // Route layers added after style loads
      map.on("load", () => {
        const bounds = STOPS.reduce(
          (b, s) => b.extend([s.lng, s.lat]),
          new mapboxgl.LngLatBounds(
            [STOPS[0].lng, STOPS[0].lat],
            [STOPS[0].lng, STOPS[0].lat]
          )
        );

        map.fitBounds(bounds, {
          padding: { top: 60, right: 80, bottom: 160, left: 540 },
          duration: 0,
        });

        // Strip all visual noise — POIs, labels, transit, road shields. Keep only roads + water + parks.
        const layersToHide = map.getStyle().layers
          .filter((layer) => {
            const id = layer.id;
            return (
              id.includes("label") ||
              id.includes("poi") ||
              id.includes("transit") ||
              id.includes("airport") ||
              id.includes("place") ||
              id.includes("settlement") ||
              id.includes("road-shield") ||
              id.includes("road-number") ||
              id.includes("housenumber") ||
              id.includes("water-point") ||
              id.includes("waterway-label") ||
              id.includes("country") ||
              id.includes("state") ||
              id.includes("admin")
            );
          })
          .map((l) => l.id);

        layersToHide.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", "none");
          }
        });

        const roadLayersToTone = map.getStyle().layers
          .filter((layer) => {
            const id = layer.id;
            return (
              id.startsWith("road-") &&
              layer.type === "line" &&
              !id.includes("label") &&
              !id.includes("shield")
            );
          })
          .map((l) => l.id);

        roadLayersToTone.forEach((id) => {
          if (map.getLayer(id)) {
            try {
              map.setPaintProperty(id, "line-color", "#E8E0D0");
            } catch (err) {
              // Some layers use data-driven expressions; skip if setPaintProperty fails
            }
          }
        });

        map.addSource("hero-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: ROUTE_COORDS },
            properties: {},
          },
        });

        // Terracotta base line
        map.addLayer({
          id: "hero-route-line",
          type: "line",
          source: "hero-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#C4664A", "line-width": 5, "line-opacity": 0.95 },
        });

        // White dashed accent on top
        map.addLayer({
          id: "hero-route-dash",
          type: "line",
          source: "hero-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 1.5,
            "line-dasharray": [1, 3],
            "line-opacity": 0.85,
          },
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
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          position: "relative",
          height: "620px",
          borderRadius: "24px",
          overflow: "hidden",
          // Mapbox Light background color — shown while tiles load
          background: "#F0EDE8",
        }}
      >
        {/* LAYER 1: Mapbox map fills container */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* LAYER 2: Left-side gradient overlay — fades map into headline area */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(248,247,243,0.97) 0%, rgba(248,247,243,0.93) 26%, rgba(248,247,243,0.55) 36%, rgba(248,247,243,0) 44%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* LAYER 3: Headline content */}
        <div
          style={{
            position: "relative",
            padding: "3rem 2rem 2rem",
            maxWidth: "600px",
            zIndex: 2,
          }}
        >
          {/* Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 11px",
              background: "white",
              border: "1px solid rgba(196,102,74,0.3)",
              borderRadius: "16px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.8px",
              color: "#C4664A",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              marginBottom: "16px",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            <div style={{ width: "5px", height: "5px", background: "#C4664A", borderRadius: "50%" }} />
            BUILD A TOUR · FLOKK POWERED
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "42px",
              fontWeight: 700,
              lineHeight: 1.02,
              color: "#1B3A5C",
              letterSpacing: "-0.8px",
              margin: "0 0 14px",
            }}
          >
            Custom Tours.
            <br />
            <span style={{ color: "#C4664A", fontStyle: "italic" }}>Catered to Your Family.</span>
          </h1>

          {/* Subhead */}
          <p
            style={{
              fontSize: "14px",
              color: "#5A6B7D",
              lineHeight: 1.55,
              maxWidth: "440px",
              margin: "0 0 20px",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            Personalized tours for your family. Plan ahead, or build one in five
            seconds when you&apos;re stuck mid-day and need a fresh idea.
          </p>

          {/* Featured chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              padding: "11px 16px",
              background: "white",
              border: "1px solid rgba(196,102,74,0.2)",
              borderRadius: "12px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            <div
              style={{
                width: "22px",
                height: "22px",
                background: "#C4664A",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>8</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#1B3A5C" }}>Featured · Tokyo</span>
            <div style={{ width: "1px", height: "14px", background: "#E0E0E0" }} />
            <span style={{ fontSize: "11px", color: "#888888" }}>Greene family · ★ 4.9</span>
          </div>
        </div>
      </div>
    </div>
  );
}
