import Link from "next/link";
import { MapPin, Compass } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";

const RECOMMENDATIONS = [
  {
    id: "r1",
    city: "Kyoto",
    country: "Japan",
    tag: "Culture",
    why: "UNESCO temples, bamboo forests, and night food markets — ideal for curious kids.",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r2",
    city: "Lisbon",
    country: "Portugal",
    tag: "Food",
    why: "Mild weather, safe neighborhoods, easy transit, and some of Europe's best pastries.",
    img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r3",
    city: "Amalfi Coast",
    country: "Italy",
    tag: "Outdoor",
    why: "Dramatic cliffs, turquoise water, and villages your kids will remember forever.",
    img: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r4",
    city: "Prague",
    country: "Czech Republic",
    tag: "Culture",
    why: "Fairy-tale architecture, walkable old town, and budget-friendly family dining.",
    img: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r5",
    city: "Madrid",
    country: "Spain",
    tag: "Food",
    why: "World-class museums, late-night tapas culture, and kid-friendly parks everywhere.",
    img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r6",
    city: "Barcelona",
    country: "Spain",
    tag: "Outdoor",
    why: "Gaudí, beaches, and a food scene that makes everyone happy — including picky eaters.",
    img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&auto=format&fit=crop&q=80",
  },
];

export default function DiscoverPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Compass size={18} style={{ color: "#C4664A" }} />
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A" }}>
              Get inspired
            </p>
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2 }}>
            Picked for your family
          </h1>
          <p style={{ fontSize: "14px", color: "#717171", marginTop: "6px", lineHeight: 1.5 }}>
            Based on your interests and travel style — places families like yours love.
          </p>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {RECOMMENDATIONS.map((rec) => (
            <div
              key={rec.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid #EEEEEE",
                boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* Image */}
              <div
                style={{
                  height: "160px",
                  backgroundImage: `url(${rec.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                    {rec.tag}
                  </span>
                </div>
              </div>
              {/* Content */}
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                  <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>
                    {rec.city}, {rec.country}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5 }}>{rec.why}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: "32px", textAlign: "center", paddingBottom: "8px" }}>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "12px" }}>
            Ready to start planning one of these?
          </p>
          <Link
            href="/trips"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              backgroundColor: "#C4664A",
              color: "#fff",
              fontWeight: 700,
              fontSize: "14px",
              borderRadius: "999px",
              textDecoration: "none",
            }}
          >
            Add a trip
          </Link>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
