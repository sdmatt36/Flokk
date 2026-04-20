import Link from "next/link";
import { Search, SlidersHorizontal, Plus, Home, Bookmark, Map, User } from "lucide-react";

const FILTERS = ["All", "Food", "Outdoor", "Culture", "Stays", "Unorganized"];

const SAVES = [
  {
    id: 1,
    title: "Mercado de San Miguel",
    location: "Madrid",
    source: "Instagram",
    category: "Food",
    image: "https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=200&q=80",
    tripAssigned: "Okinawa May '25",
    distance: "600m from hotel",
  },
  {
    id: 2,
    title: "Arashiyama Bamboo Grove",
    location: "Kyoto",
    source: "TikTok",
    category: "Outdoor",
    image: "https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=200&q=80",
    tripAssigned: undefined,
    distance: undefined,
  },
  {
    id: 3,
    title: "Villa Cimbrone Gardens",
    location: "Ravello",
    source: "Email",
    category: "Culture",
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=200&q=80",
    tripAssigned: undefined,
    distance: undefined,
  },
  {
    id: 4,
    title: "Le Comptoir du Relais",
    location: "Paris",
    source: "Airbnb",
    category: "Food",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200&q=80",
    tripAssigned: "Okinawa May '25",
    distance: "1.2km from hotel",
  },
];

export default function SavesNewPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: "56px", paddingBottom: "20px",
        }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>Your saves</h1>
          <button style={{
            width: "40px", height: "40px", borderRadius: "12px",
            backgroundColor: "#fff", border: "1.5px solid #EEEEEE",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <SlidersHorizontal size={18} style={{ color: "#717171" }} />
          </button>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <Search size={16} style={{
            position: "absolute", left: "16px", top: "50%",
            transform: "translateY(-50%)", color: "#717171",
          }} />
          <input
            type="text"
            placeholder="Search saves, destinations, tags..."
            readOnly
            style={{
              width: "100%", height: "48px", paddingLeft: "44px", paddingRight: "16px",
              borderRadius: "24px", border: "none", backgroundColor: "#F5F5F5",
              fontSize: "14px", color: "#717171", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Active trip banner */}
        <div style={{
          backgroundColor: "#C4664A", borderRadius: "16px",
          padding: "12px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "16px",
        }}>
          <span style={{ fontSize: "13px", color: "#fff", fontWeight: 500 }}>
            ✈️&nbsp; Planning Okinawa · 3 saves match this trip
          </span>
          <button style={{
            backgroundColor: "transparent", border: "1.5px solid rgba(255,255,255,0.7)",
            borderRadius: "16px", padding: "4px 12px", fontSize: "12px",
            color: "#fff", fontWeight: 600, cursor: "pointer", flexShrink: 0, marginLeft: "12px",
          }}>
            Review →
          </button>
        </div>

        {/* Filter strip */}
        <div style={{
          display: "flex", gap: "8px", overflowX: "auto", overscrollBehaviorX: "contain",
          marginBottom: "20px", paddingBottom: "4px", scrollbarWidth: "none",
          marginLeft: "-20px", marginRight: "-20px",
          paddingLeft: "20px", paddingRight: "40px",
        } as React.CSSProperties}>
          {FILTERS.map((filter) => {
            const active = filter === "All";
            return (
              <button key={filter} style={{
                flexShrink: 0, padding: "7px 16px", borderRadius: "20px",
                border: `1.5px solid ${active ? "#C4664A" : "#EEEEEE"}`,
                backgroundColor: active ? "#C4664A" : "transparent",
                color: active ? "#fff" : "#717171",
                fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {filter}
              </button>
            );
          })}
        </div>

        {/* Save cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          {SAVES.map((save) => (
            <div key={save.id} style={{
              backgroundColor: "#F5F5F5", borderRadius: "16px", padding: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex",
              gap: "12px", alignItems: "flex-start",
            }}>
              {/* Thumbnail */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={save.image} alt={save.title} style={{
                width: "80px", height: "80px", objectFit: "cover",
                borderRadius: "10px", flexShrink: 0,
              }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px", lineHeight: 1.3 }}>
                  {save.title}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#717171" }}>{save.location}</span>
                  <span style={{
                    fontSize: "11px", color: "#C4664A",
                    backgroundColor: "rgba(196,102,74,0.1)",
                    borderRadius: "6px", padding: "1px 6px", fontWeight: 500,
                  }}>
                    {save.source}
                  </span>
                </div>
                <div style={{ marginBottom: "7px" }}>
                  <span style={{
                    fontSize: "11px", color: "#717171",
                    backgroundColor: "rgba(0,0,0,0.06)",
                    borderRadius: "6px", padding: "1px 6px", fontWeight: 500,
                  }}>
                    {save.category}
                  </span>
                </div>

                {/* Bottom row: trip pill + distance */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {save.tripAssigned ? (
                    <span style={{
                      fontSize: "11px", color: "#6B8F71",
                      backgroundColor: "rgba(107,143,113,0.12)",
                      borderRadius: "8px", padding: "2px 8px", fontWeight: 600,
                    }}>
                      ✈️ {save.tripAssigned}
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#C4664A", fontWeight: 600, cursor: "pointer" }}>
                      + Assign to trip
                    </span>
                  )}
                  {save.distance && (
                    <span style={{ fontSize: "11px", color: "#717171" }}>{save.distance}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Unorganized nudge */}
        <div style={{
          backgroundColor: "rgba(196,102,74,0.08)", borderLeft: "3px solid #C4664A",
          borderRadius: "0 12px 12px 0", padding: "12px 16px", marginBottom: "24px",
        }}>
          <p style={{ fontSize: "14px", color: "#1a1a1a", fontWeight: 600, marginBottom: "2px" }}>
            📦 12 saves aren&apos;t assigned to a trip yet
          </p>
          <p style={{ fontSize: "13px", color: "#717171" }}>Tap to organize them</p>
        </div>

      </div>

      {/* FAB */}
      <button style={{
        position: "fixed", bottom: "100px", right: "24px",
        width: "56px", height: "56px", borderRadius: "50%",
        backgroundColor: "#C4664A", color: "#fff", border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 16px rgba(196,102,74,0.4)", cursor: "pointer", zIndex: 10,
      }}>
        <Plus size={24} />
      </button>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        backgroundColor: "#fff", borderTop: "1px solid #EEEEEE",
        padding: "12px 32px", zIndex: 20,
      }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", display: "flex", justifyContent: "space-around" }}>
          {[
            { label: "Home", icon: <Home size={22} />, href: "/home" },
            { label: "Saves", icon: <Bookmark size={22} />, href: "/saves-new", active: true },
            { label: "Trips", icon: <Map size={22} />, href: "/trips" },
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
