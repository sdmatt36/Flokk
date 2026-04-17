"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home, Bookmark, Map, User, ChevronLeft,
  MapPin, Plus, Check, Sparkles, Plane,
} from "lucide-react";

// ── Static data ───────────────────────────────────────────────────────────────

const SAVED_SECTIONS = [
  {
    icon: "🏨",
    label: "LODGING",
    items: [
      {
        title: "Halekulani Okinawa",
        detail: "Onna Village · 5 nights · ¥45,000/night",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
        booked: true,
      },
    ],
  },
  {
    icon: "✈️",
    label: "AIRFARE",
    items: [
      {
        title: "JAL · Tokyo → Naha",
        detail: "May 4 · 2h 45m · ¥28,000 total",
        noPhoto: true,
        booked: true,
      },
    ],
  },
  {
    icon: "🍜",
    label: "RESTAURANTS",
    items: [
      {
        title: "Naha Kokusai-dori Street Food",
        detail: "Naha · Street Food · Evening",
        image: "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=200&q=80",
        assignToDay: true,
      },
      {
        title: "Makishi Public Market",
        detail: "Naha · Local Markets · Morning",
        image: "https://images.unsplash.com/photo-1552566626-52f8b828329d?w=200&q=80",
        assignToDay: true,
      },
    ],
  },
  {
    icon: "🎯",
    label: "ACTIVITIES",
    items: [
      {
        title: "Churaumi Aquarium",
        detail: "Motobu · Family · Half day",
        image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80",
        tags: ["Aquarium", "Family"],
        assignToDay: true,
      },
      {
        title: "Katsuren Castle Ruins",
        detail: "Uruma · History · 2 hours",
        image: "https://images.unsplash.com/photo-1548625149-720754274e8e?w=200&q=80",
        tags: ["History", "Culture"],
        assignToDay: true,
      },
    ],
  },
];

const RECOMMENDED = [
  {
    title: "Shuri Castle",
    location: "Naha, Okinawa",
    matchReason: "Your kids are 6+ · History & Culture interest · 20 min from hotel",
    image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=200&q=80",
  },
  {
    title: "Cape Manzamo",
    location: "Onna, Okinawa",
    matchReason: "Outdoor interest · Stunning at sunset · Kid-friendly",
    image: "https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=200&q=80",
  },
  {
    title: "Okinawa World & Gyokusendo Cave",
    location: "Nanjo, Okinawa",
    matchReason: "Kids aged 6–12 love this · Adventure interest · Half day",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=80",
  },
];

const DAYS = [
  { num: 1, day: "Sunday", date: "May 4" },
  { num: 2, day: "Monday", date: "May 5" },
  { num: 3, day: "Tuesday", date: "May 6" },
  { num: 4, day: "Wednesday", date: "May 7" },
  { num: 5, day: "Thursday", date: "May 8" },
];

// ── Shared card components ────────────────────────────────────────────────────

function TripCard({
  title, detail, image, noPhoto, tags, booked, assignToDay,
}: {
  title: string; detail: string; image?: string; noPhoto?: boolean;
  tags?: string[]; booked?: boolean; assignToDay?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: "#F5F5F5", borderRadius: "14px", padding: "12px",
      display: "flex", gap: "12px", alignItems: "flex-start",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    }}>
      {noPhoto ? (
        <div style={{
          width: "72px", height: "72px", borderRadius: "10px",
          backgroundColor: "#d4cdc3", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}>
          <Plane size={22} style={{ color: "#9a9a9a" }} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={title} style={{
          width: "72px", height: "72px", objectFit: "cover",
          borderRadius: "10px", flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "3px", lineHeight: 1.3 }}>
          {title}
        </p>
        <p style={{ fontSize: "12px", color: "#717171", marginBottom: tags ? "5px" : "6px" }}>
          {detail}
        </p>
        {tags && (
          <div style={{ display: "flex", gap: "4px", marginBottom: "6px", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <span key={tag} style={{
                fontSize: "11px", color: "#717171",
                backgroundColor: "rgba(0,0,0,0.06)",
                borderRadius: "6px", padding: "1px 6px", fontWeight: 500,
              }}>{tag}</span>
            ))}
          </div>
        )}
        {booked && (
          <span style={{
            fontSize: "11px", color: "#6B8F71",
            backgroundColor: "rgba(107,143,113,0.15)",
            borderRadius: "8px", padding: "2px 8px", fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: "3px",
          }}>
            <Check size={10} strokeWidth={3} /> Booked
          </span>
        )}
        {assignToDay && (
          <span style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, cursor: "pointer" }}>
            + Assign to day
          </span>
        )}
      </div>
    </div>
  );
}

function RecoCard({ title, location, matchReason, image }: {
  title: string; location: string; matchReason: string; image: string;
}) {
  return (
    <div style={{
      backgroundColor: "#F5F5F5", borderRadius: "14px", padding: "12px",
      display: "flex", gap: "12px", alignItems: "flex-start",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={title} style={{
        width: "72px", height: "72px", objectFit: "cover",
        borderRadius: "10px", flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>{title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
          <MapPin size={11} style={{ color: "#717171" }} />
          <p style={{ fontSize: "12px", color: "#717171" }}>{location}</p>
        </div>
        <p style={{ fontSize: "11px", color: "#7a7a7a", marginBottom: "8px", lineHeight: 1.45 }}>
          {matchReason}
        </p>
        <button style={{
          fontSize: "11px", color: "#C4664A", fontWeight: 600,
          border: "1.5px solid #C4664A", borderRadius: "12px",
          padding: "3px 10px", backgroundColor: "transparent", cursor: "pointer",
        }}>
          + Save to trip
        </button>
      </div>
    </div>
  );
}

function FilledSlot({ image, title, duration }: { image?: string; title: string; duration: string }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: "12px", padding: "10px 12px",
      display: "flex", gap: "10px", alignItems: "center",
      border: "1.5px solid #EEEEEE",
    }}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={title} style={{
          width: "44px", height: "44px", objectFit: "cover",
          borderRadius: "8px", flexShrink: 0,
        }} />
      )}
      <div>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{title}</p>
        <p style={{ fontSize: "11px", color: "#717171" }}>{duration}</p>
      </div>
    </div>
  );
}

function EmptySlot({ ai }: { ai?: boolean }) {
  return (
    <div style={{
      border: "1.5px dashed #d0c8b8", borderRadius: "12px",
      padding: "14px 16px", textAlign: "center", cursor: "pointer",
    }}>
      <span style={{ fontSize: "13px", color: ai ? "#C4664A" : "#AAAAAA", fontWeight: 500 }}>
        {ai ? "✨ Get a suggestion" : "+ Add something"}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TripDetailClient({ playfairClass, initialTab = "saved" }: { playfairClass: string; initialTab?: "saved" | "itinerary" | "recommended" }) {
  const [activeTab, setActiveTab] = useState<"saved" | "itinerary" | "recommended">(initialTab);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>

      {/* Hero */}
      <div style={{ position: "relative", height: "200px", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1590253230532-a67f6bc61b9e?w=800&q=80"
          alt="Okinawa"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)",
        }} />

        {/* Back button */}
        <Link href="/trips" style={{
          position: "absolute", top: "16px", left: "16px", zIndex: 2,
          display: "flex", alignItems: "center", gap: "4px",
          backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.3)", borderRadius: "20px",
          padding: "6px 14px", color: "#fff", textDecoration: "none",
          fontSize: "13px", fontWeight: 600,
        }}>
          <ChevronLeft size={15} /> Trips
        </Link>

        {/* Status pill */}
        <div style={{
          position: "absolute", top: "16px", right: "16px", zIndex: 2,
          backgroundColor: "rgba(255,255,255,0.92)", borderRadius: "20px", padding: "4px 12px",
        }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#6B8F71" }}>Planning</span>
        </div>

        {/* Title + subtext anchored to bottom */}
        <div style={{ position: "absolute", bottom: "20px", left: "20px", right: "20px", zIndex: 2 }}>
          <h1 className={playfairClass} style={{
            fontSize: "28px", fontWeight: 900, color: "#fff", lineHeight: 1.1,
            marginBottom: "6px", textShadow: "0 2px 14px rgba(0,0,0,0.45)",
          }}>
            Okinawa May &apos;25
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.88)" }}>
            📍 Okinawa, Japan &nbsp;·&nbsp; 📅 May 4 – May 8, 2025
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "0 20px" }}>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px", marginBottom: "20px" }}>
          {[
            { value: "3", label: "Spots saved" },
            { value: "5", label: "Days" },
          ].map((stat) => (
            <div key={stat.label} style={{
              flex: 1, backgroundColor: "#fff", borderRadius: "14px",
              border: "1.5px solid #EEEEEE", padding: "14px", textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <p style={{ fontSize: "28px", fontWeight: 800, color: "#C4664A", lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: "12px", color: "#717171", marginTop: "4px" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #EEEEEE", marginBottom: "20px" }}>
          {(["saved", "itinerary", "recommended"] as const).map((tab) => {
            const labels = { saved: "Saved", itinerary: "Itinerary", recommended: "Recommended" };
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, paddingBottom: "12px", paddingTop: "4px",
                fontSize: "14px", fontWeight: active ? 700 : 500,
                color: active ? "#1a1a1a" : "#717171",
                backgroundColor: "transparent", border: "none",
                borderBottom: active ? "2.5px solid #C4664A" : "2.5px solid transparent",
                cursor: "pointer", marginBottom: "-1px",
              }}>
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── SAVED TAB ── */}
        {activeTab === "saved" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {SAVED_SECTIONS.map((section) => (
              <div key={section.label}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: "10px",
                }}>
                  <span style={{
                    fontSize: "13px", fontWeight: 700, color: "#2d4a3e",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>
                    {section.icon} {section.label}
                  </span>
                  <span style={{ fontSize: "12px", color: "#717171" }}>{section.items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {section.items.map((item, i) => (
                    <TripCard key={i} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ITINERARY TAB ── */}
        {activeTab === "itinerary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {DAYS.map((day, dayIdx) => (
              <div key={day.num}>
                {/* Day header */}
                <div style={{
                  backgroundColor: "#2d4a3e", borderRadius: "10px",
                  padding: "9px 14px", marginBottom: "12px",
                }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                    Day {day.num} · {day.day} {day.date}
                  </p>
                </div>

                {/* Time slots */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(["Morning", "Afternoon", "Evening"] as const).map((slot, slotIdx) => {
                    let content: React.ReactNode;
                    if (day.num === 1) {
                      if (slot === "Morning") {
                        content = (
                          <FilledSlot
                            image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80"
                            title="Churaumi Aquarium"
                            duration="Half day · Family"
                          />
                        );
                      } else if (slot === "Afternoon") {
                        content = <EmptySlot ai />;
                      } else {
                        content = (
                          <FilledSlot
                            image="https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=200&q=80"
                            title="Kokusai-dori Street Food"
                            duration="Evening · Street food"
                          />
                        );
                      }
                    } else {
                      content = <EmptySlot ai={slotIdx % 2 === 1} />;
                    }

                    return (
                      <div key={slot}>
                        <p style={{
                          fontSize: "10px", fontWeight: 700, color: "#717171",
                          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px",
                        }}>
                          {slot}
                        </p>
                        {content}
                      </div>
                    );
                  })}
                </div>

                {/* AI banner after Day 1 */}
                {dayIdx === 0 && (
                  <div style={{
                    marginTop: "16px",
                    backgroundColor: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A",
                    borderRadius: "0 10px 10px 0", padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", flex: 1 }}>
                      <Sparkles size={15} style={{ color: "#C4664A", flexShrink: 0, marginTop: "1px" }} />
                      <p style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: 1.45 }}>
                        You have 3 free afternoons — want suggestions near your hotel?
                      </p>
                    </div>
                    <span style={{ fontSize: "12px", color: "#C4664A", fontWeight: 700, flexShrink: 0, cursor: "pointer" }}>
                      Fill the gaps →
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── RECOMMENDED TAB ── */}
        {activeTab === "recommended" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "#717171", marginBottom: "4px" }}>
              Based on your interests and family profile.
            </p>
            {RECOMMENDED.map((item, i) => (
              <RecoCard key={i} {...item} />
            ))}
          </div>
        )}

        {/* Add place CTA */}
        <div style={{ marginTop: "24px", marginBottom: "8px" }}>
          <button style={{
            width: "100%", height: "48px", borderRadius: "24px",
            border: "1.5px dashed #C4664A", backgroundColor: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", cursor: "pointer",
          }}>
            <Plus size={16} style={{ color: "#C4664A" }} />
            <span style={{ fontSize: "14px", color: "#C4664A", fontWeight: 600 }}>Add a place</span>
          </button>
        </div>

      </div>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        backgroundColor: "#fff", borderTop: "1px solid #EEEEEE", padding: "12px 32px",
      }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", display: "flex", justifyContent: "space-around" }}>
          {[
            { label: "Home", icon: <Home size={22} />, href: "/home" },
            { label: "Saves", icon: <Bookmark size={22} />, href: "/saves" },
            { label: "Trips", icon: <Map size={22} />, href: "/trips", active: true },
            { label: "Profile", icon: <User size={22} />, href: "/profile" },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "4px", color: item.active ? "#C4664A" : "#AAAAAA", textDecoration: "none",
            }}>
              {item.icon}
              <span style={{ fontSize: "11px", fontWeight: 500 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
