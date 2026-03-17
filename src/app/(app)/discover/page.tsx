"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Compass, Sparkles, BookOpen, Clock, ChevronRight } from "lucide-react";

const RECOMMENDATIONS = [
  {
    id: "r1",
    city: "Kyoto",
    country: "Japan",
    tag: "Culture",
    region: "Asia",
    why: "UNESCO temples, bamboo forests, and night food markets — ideal for curious kids.",
    pickReason: "Matches your love of history and slow travel with kids.",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r2",
    city: "Lisbon",
    country: "Portugal",
    tag: "City Break",
    region: "Europe",
    why: "Mild weather, safe neighborhoods, easy transit, and some of Europe's best pastries.",
    pickReason: "Highly rated by families who value walkability and great food.",
    img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r3",
    city: "Amalfi Coast",
    country: "Italy",
    tag: "Beach",
    region: "Europe",
    why: "Dramatic cliffs, turquoise water, and villages your kids will remember forever.",
    pickReason: "A top pick for families who've loved coastal destinations.",
    img: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r4",
    city: "Prague",
    country: "Czech Republic",
    tag: "Culture",
    region: "Europe",
    why: "Fairy-tale architecture, walkable old town, and budget-friendly family dining.",
    pickReason: "Families who loved Vienna and Budapest consistently rate Prague next.",
    img: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r5",
    city: "Madrid",
    country: "Spain",
    tag: "Food",
    region: "Europe",
    why: "World-class museums, late-night tapas culture, and kid-friendly parks everywhere.",
    pickReason: "Perfect for food-first families who want culture on the side.",
    img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r6",
    city: "Barcelona",
    country: "Spain",
    tag: "Outdoor",
    region: "Europe",
    why: "Gaudí, beaches, and a food scene that makes everyone happy — including picky eaters.",
    pickReason: "Ranked #1 by families who want cities with beach access.",
    img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r7",
    city: "Bali",
    country: "Indonesia",
    tag: "Beach",
    region: "Asia",
    why: "Rice terraces, temple ceremonies, and warm shallow seas that kids adore.",
    pickReason: "A consistent favorite for families seeking beach + culture in Asia.",
    img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=80",
  },
  {
    id: "r8",
    city: "Hokkaido",
    country: "Japan",
    tag: "Adventure",
    region: "Asia",
    why: "World-class skiing, hot springs, and farm-to-table dairy that kids go wild for.",
    pickReason: "Top pick for active families after a Japan alpine experience.",
    img: "https://images.unsplash.com/photo-1542931287-023b922fa89b?w=600&auto=format&fit=crop&q=80",
  },
];

const FILTERS = ["All", "Culture", "Food", "Outdoor", "Adventure", "Beach", "City Break", "Asia", "Europe"];

const COMMUNITY_TRIPS = [
  {
    slug: "tokyo-with-kids",
    heroImage: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&auto=format&fit=crop&q=80",
    title: "10 Days in Tokyo",
    destination: "Tokyo, Japan",
    duration: "10 days",
    tags: ["Culture", "Food"],
    highlights: ["teamLab Borderless", "Shibuya Crossing", "Tsukiji Market"],
    familyName: "The Nakamura Family",
  },
  {
    slug: "barcelona-family",
    heroImage: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&auto=format&fit=crop&q=80",
    title: "Barcelona with Tweens",
    destination: "Barcelona, Spain",
    duration: "7 days",
    tags: ["Outdoor", "Food"],
    highlights: ["Sagrada Família", "Park Güell", "La Barceloneta"],
    familyName: "The Rivera Family",
  },
  {
    slug: "lisbon-escape",
    heroImage: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80",
    title: "Long Weekend in Lisbon",
    destination: "Lisbon, Portugal",
    duration: "4 days",
    tags: ["City Break", "Food"],
    highlights: ["Alfama trams", "Pastéis de Belém", "Sintra day trip"],
    familyName: "The Andersons",
  },
  {
    slug: "bali-family-month",
    heroImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&auto=format&fit=crop&q=80",
    title: "Bali Slow Travel",
    destination: "Bali, Indonesia",
    duration: "14 days",
    tags: ["Beach", "Culture"],
    highlights: ["Ubud rice terraces", "Seminyak beach", "Tirta Empul"],
    familyName: "The Park Family",
  },
];

const TRAVEL_INTEL = [
  {
    id: "ti1",
    category: "Planning",
    title: "How to book award flights for 4 — without losing your mind",
    excerpt: "The sweet spots in Chase, Amex, and Flying Blue that family travelers actually use.",
    readTime: "5 min",
    img: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "ti2",
    category: "Destination",
    title: "Japan with kids under 10: what nobody tells you",
    excerpt: "Practical tips on pacing, food, strollers, and why Kyoto beats Tokyo for young kids.",
    readTime: "7 min",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "ti3",
    category: "Packing",
    title: "The carry-on-only family packing list (tested on 12 trips)",
    excerpt: "What three kids and two adults actually need for two weeks in Europe.",
    readTime: "4 min",
    img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80",
  },
];

export default function DiscoverPage() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? RECOMMENDATIONS
    : RECOMMENDATIONS.filter(r =>
        r.tag === activeFilter || r.region === activeFilter
      );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
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

        {/* Filter bar */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "12px",
            marginBottom: "20px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          className="hide-scrollbar"
        >
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: "999px",
                border: activeFilter === f ? "none" : "1.5px solid #E0E0E0",
                backgroundColor: activeFilter === f ? "#C4664A" : "#fff",
                color: activeFilter === f ? "#fff" : "#717171",
                fontSize: "13px",
                fontWeight: activeFilter === f ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Destination grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
            {filtered.map((rec) => (
              <div
                key={rec.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
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
                  <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>{rec.why}</p>
                  {/* Pick reason */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <Sparkles size={11} style={{ color: "#C4664A", flexShrink: 0, marginTop: "2px" }} />
                    <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500 }}>{rec.pickReason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#717171" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>No destinations here yet</p>
            <p style={{ fontSize: "13px" }}>More {activeFilter} picks coming soon.</p>
          </div>
        )}

        {/* Community trips strip */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>
                Trips families like yours loved
              </h2>
              <p style={{ fontSize: "13px", color: "#717171" }}>Real itineraries from the Flokk community</p>
            </div>
            <button style={{ background: "none", border: "none", fontSize: "12px", color: "#C4664A", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
              See all <ChevronRight size={13} />
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              paddingBottom: "8px",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            className="hide-scrollbar"
          >
            {COMMUNITY_TRIPS.map((trip) => (
              <div
                key={trip.slug}
                className="hover:opacity-95 transition-opacity cursor-pointer"
                style={{
                  flexShrink: 0,
                  width: "220px",
                  backgroundColor: "#fff",
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #EEEEEE",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    height: "120px",
                    backgroundImage: `url(${trip.heroImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
                  <div style={{ position: "absolute", bottom: "8px", left: "10px", right: "10px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.title}</p>
                  </div>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                    <MapPin size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: "#2d2d2d", fontWeight: 600 }}>{trip.destination}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#717171", marginBottom: "6px" }}>{trip.duration} · {trip.tags.join(", ")}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {trip.highlights.slice(0, 2).map(h => (
                      <span key={h} style={{ fontSize: "10px", backgroundColor: "rgba(196,102,74,0.08)", color: "#C4664A", borderRadius: "6px", padding: "2px 7px", fontWeight: 500 }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: "10px", color: "#AAAAAA", marginTop: "8px" }}>by {trip.familyName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Travel Intel */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <BookOpen size={15} style={{ color: "#C4664A" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a" }}>Travel Intel</h2>
          </div>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>Guides and tips from our editorial team</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {TRAVEL_INTEL.map((article) => (
              <div
                key={article.id}
                style={{
                  display: "flex",
                  gap: "14px",
                  backgroundColor: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #EEEEEE",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: "90px",
                    backgroundImage: `url(${article.img})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div style={{ padding: "12px 12px 12px 0", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#C4664A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {article.category}
                    </span>
                    <span style={{ fontSize: "10px", color: "#AAAAAA" }}>·</span>
                    <Clock size={10} style={{ color: "#AAAAAA" }} />
                    <span style={{ fontSize: "10px", color: "#AAAAAA" }}>{article.readTime}</span>
                  </div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, marginBottom: "4px" }}>
                    {article.title}
                  </p>
                  <p style={{ fontSize: "11px", color: "#717171", lineHeight: 1.4 }}>{article.excerpt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: "40px", textAlign: "center", paddingBottom: "8px" }}>
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
    </div>
  );
}
