"use client";

import { useState, useEffect } from "react";
import {
  Plane, Bookmark, Globe, Calendar,
  Map, Utensils, Star, Camera, Heart, Users,
  Layers, Compass, Navigation, Award,
  Copy,
} from "lucide-react";

interface StatsData {
  tripsTaken: number;
  placesSaved: number;
  countriesVisited: number;
  avgTripLength: number | null;
  tier: "EXPLORER" | "NAVIGATOR" | "PIONEER";
  points: number;
}

const TIER_CONFIG = {
  EXPLORER: {
    label: "Explorer",
    bg: "#F5F5F5", color: "#717171",
    border: "#E8E8E8",
    nextLabel: "Navigator", threshold: 500,
    desc: "You're just getting started. Keep saving and contributing to level up.",
  },
  NAVIGATOR: {
    label: "Navigator",
    bg: "rgba(27,58,92,0.08)", color: "#1B3A5C",
    border: "rgba(27,58,92,0.2)",
    nextLabel: "Pioneer", threshold: 2000,
    desc: "You're a consistent contributor. Premium features unlocked.",
  },
  PIONEER: {
    label: "Pioneer",
    bg: "rgba(196,102,74,0.08)", color: "#C4664A",
    border: "rgba(196,102,74,0.2)",
    nextLabel: null, threshold: null,
    desc: "Top contributor. Priority placement, early access, and complimentary Pro.",
  },
};

const TIER_UNLOCKS = [
  {
    name: "Explorer",
    perks: ["Basic recommendations", "Community access", "Save up to 50 places"],
  },
  {
    name: "Navigator",
    perks: ["Verified badge", "Priority search placement", "Premium features unlocked"],
  },
  {
    name: "Pioneer",
    perks: ["Complimentary Pro membership", "Early feature access", "Maximum subscription credit"],
  },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff", borderRadius: "12px",
  border: "1px solid #E8E8E8", padding: "24px",
};

// ── Stat Cards ─────────────────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{
      ...cardStyle,
      borderLeft: "4px solid #C4664A",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px",
    }}>
      {icon}
      <p style={{ fontSize: "36px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "13px", color: "#717171", margin: 0 }}>{label}</p>
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────

interface BadgeDef {
  name: string;
  icon: React.ReactNode;
  earned: boolean;
  earnedDate?: string;
  isFounder?: boolean;
}

function Badge({ badge }: { badge: BadgeDef }) {
  const circleBg = badge.earned
    ? badge.isFounder ? "rgba(196,102,74,0.1)" : "rgba(27,58,92,0.08)"
    : "#F5F5F5";
  const circleBorder = badge.earned
    ? badge.isFounder ? "2px solid rgba(196,102,74,0.3)" : "2px solid rgba(27,58,92,0.2)"
    : "2px solid #E8E8E8";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", opacity: badge.earned ? 1 : 0.4, filter: badge.earned ? "none" : "grayscale(1)" }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "50%",
        backgroundColor: circleBg, border: circleBorder,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {badge.icon}
      </div>
      <p style={{ fontSize: "11px", fontWeight: 500, textAlign: "center", color: "#1a1a1a", margin: 0, lineHeight: 1.3 }}>{badge.name}</p>
      <p style={{ fontSize: "10px", color: "#717171", textAlign: "center", margin: 0 }}>
        {badge.earned ? (badge.earnedDate ?? "Earned") : "Locked"}
      </p>
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────────────

export function StatsSection() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteUrl = "https://flokktravel.com/invite/your-link";
  const today = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCopy() {
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tier = data?.tier ?? "EXPLORER";
  const points = data?.points ?? 0;
  const tierCfg = TIER_CONFIG[tier];
  const placesSaved = data?.placesSaved ?? 0;
  const tripsTaken = data?.tripsTaken ?? 0;

  // Progress bar
  let progressPct = 0;
  let progressLabel = "";
  if (tier === "EXPLORER") {
    progressPct = Math.min(points / 500, 1) * 100;
    progressLabel = `${points} / 500 points to Navigator`;
  } else if (tier === "NAVIGATOR") {
    progressPct = Math.min((points - 500) / 1500, 1) * 100;
    progressLabel = `${points} / 2000 points to Pioneer`;
  } else {
    progressPct = 100;
    progressLabel = "Maximum tier reached";
  }

  // Badges
  const badges: BadgeDef[] = [
    {
      name: "First Save",
      icon: <Bookmark size={22} style={{ color: placesSaved > 0 ? "#1B3A5C" : "#CCCCCC" }} />,
      earned: placesSaved > 0,
      earnedDate: placesSaved > 0 ? today : undefined,
    },
    {
      name: "Trip Planner",
      icon: <Map size={22} style={{ color: tripsTaken > 0 ? "#1B3A5C" : "#CCCCCC" }} />,
      earned: tripsTaken > 0,
      earnedDate: tripsTaken > 0 ? today : undefined,
    },
    {
      name: "Bon Vivant",
      icon: <Utensils size={22} style={{ color: "#CCCCCC" }} />,
      earned: false,
    },
    {
      name: "World Citizen",
      icon: <Globe size={22} style={{ color: "#CCCCCC" }} />,
      earned: false,
    },
    {
      name: "Founding Contributor",
      icon: <Star size={22} style={{ color: "#C4664A" }} />,
      earned: true,
      earnedDate: "Beta",
      isFounder: true,
    },
    {
      name: "Memory Keeper",
      icon: <Camera size={22} style={{ color: "#CCCCCC" }} />,
      earned: false,
    },
    {
      name: "Community Gem",
      icon: <Heart size={22} style={{ color: "#CCCCCC" }} />,
      earned: false,
    },
    {
      name: "Pack Leader",
      icon: <Users size={22} style={{ color: "#CCCCCC" }} />,
      earned: false,
    },
    {
      name: "50 Saves",
      icon: <Layers size={22} style={{ color: placesSaved >= 50 ? "#1B3A5C" : "#CCCCCC" }} />,
      earned: placesSaved >= 50,
      earnedDate: placesSaved >= 50 ? today : undefined,
    },
    {
      name: "Explorer",
      icon: <Compass size={22} style={{ color: "#1B3A5C" }} />,
      earned: true,
      earnedDate: today,
    },
    {
      name: "Navigator",
      icon: <Navigation size={22} style={{ color: "#CCCCCC" }} />,
      earned: tier === "NAVIGATOR" || tier === "PIONEER",
    },
    {
      name: "Pioneer",
      icon: <Award size={22} style={{ color: "#CCCCCC" }} />,
      earned: tier === "PIONEER",
    },
  ];

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* A — Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<Plane size={20} style={{ color: "#C4664A" }} />}
          value={String(data?.tripsTaken ?? 0)}
          label="Trips taken"
        />
        <StatCard
          icon={<Bookmark size={20} style={{ color: "#C4664A" }} />}
          value={String(placesSaved)}
          label="Places saved"
        />
        <StatCard
          icon={<Globe size={20} style={{ color: "#C4664A" }} />}
          value={String(data?.countriesVisited ?? 0)}
          label="Countries visited"
        />
        <StatCard
          icon={<Calendar size={20} style={{ color: "#C4664A" }} />}
          value={data?.avgTripLength != null ? String(data.avgTripLength) : "—"}
          label="Avg. trip length (days)"
        />
      </div>

      {/* B — World map placeholder */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>Countries visited</p>
        <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, margin: "0 0 16px" }}>
          {data?.countriesVisited ? `${data.countriesVisited} ${data.countriesVisited === 1 ? "country" : "countries"}` : (
            <span style={{ color: "#717171", fontWeight: 400 }}>Your map is waiting. Complete a trip to start filling it in.</span>
          )}
        </p>
        <div style={{
          width: "100%", height: "160px", backgroundColor: "#E8EEF4", borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <p style={{ color: "#717171", fontSize: "13px", margin: 0 }}>Interactive map coming soon</p>
        </div>
      </div>

      {/* C — Tier progress */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Contribution tier</p>
          <span style={{
            padding: "4px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 600,
            backgroundColor: tierCfg.bg, color: tierCfg.color, border: `1px solid ${tierCfg.border}`,
          }}>
            {tierCfg.label}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#F5F5F5", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", backgroundColor: "#1B3A5C", borderRadius: "999px", transition: "width 0.4s ease" }} />
          </div>
          <p style={{ fontSize: "11px", color: "#717171", marginTop: "4px", marginBottom: 0 }}>{progressLabel}</p>
        </div>

        {/* Tier columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginTop: "20px" }}>
          {TIER_UNLOCKS.map((t) => (
            <div key={t.name}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 8px" }}>{t.name}</p>
              {t.perks.map((perk) => (
                <p key={perk} style={{ fontSize: "12px", color: "#717171", margin: "0 0 4px", lineHeight: 1.4 }}>
                  {perk}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* D — Badges */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Badges</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {badges.map((b) => <Badge key={b.name} badge={b} />)}
        </div>
      </div>

      {/* E — Community impact */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>Your impact</p>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 20px" }}>
          How your saves and trips have helped other families.
        </p>
        {[
          { num: "0", label: "Families helped", desc: "Families who saved one of your trips or recommendations" },
          { num: "0", label: "Saves inspired", desc: "Times your saves or tips were saved by another family" },
          { num: "0", label: "Destinations contributed", desc: "Destinations where you have shared recommendations" },
        ].map((item, i) => (
          <div key={item.label}>
            {i > 0 && <div style={{ borderTop: "1px solid #E8E8E8", margin: "12px 0" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#1B3A5C", minWidth: "40px" }}>{item.num}</span>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "#1B3A5C", margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0" }}>{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "12px", color: "#717171", textAlign: "center", margin: "-8px 0 0" }}>
        Start contributing to see your impact grow. Save places, complete trips, and share with the community.
      </p>

      {/* F — Invite */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>Invite friends</p>
        <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 16px" }}>
          Know a family who&apos;d love Flokk? Invite them.
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="friend@email.com"
            type="email"
            style={{
              flex: 1, padding: "9px 12px", border: "1px solid #E8E8E8",
              borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none",
            }}
          />
          <button style={{
            backgroundColor: "#1B3A5C", color: "#fff", border: "none",
            borderRadius: "8px", padding: "9px 16px", fontSize: "13px",
            fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            Send invite
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 8px" }}>Or share your invite link</p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            readOnly
            value={inviteUrl}
            style={{
              flex: 1, padding: "9px 12px", border: "1px solid #E8E8E8",
              borderRadius: "8px", fontSize: "13px", color: "#717171",
              backgroundColor: "#F9F9F9", outline: "none",
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: "4px", background: "none",
              border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500,
              color: copied ? "#1B3A5C" : "#C4664A", whiteSpace: "nowrap", padding: "4px 0",
            }}
          >
            <Copy size={14} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
