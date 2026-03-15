"use client";

import { useState, useEffect } from "react";
import {
  Bookmark, Globe,
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
    desc: "You're just getting started. Every save and trip earns points.",
  },
  NAVIGATOR: {
    label: "Navigator",
    bg: "rgba(27,58,92,0.08)", color: "#1B3A5C",
    border: "rgba(27,58,92,0.2)",
    nextLabel: "Pioneer", threshold: 2000,
    desc: "Consistent contributor. Premium features and verified badge unlocked.",
  },
  PIONEER: {
    label: "Pioneer",
    bg: "rgba(196,102,74,0.08)", color: "#C4664A",
    border: "rgba(196,102,74,0.2)",
    nextLabel: null, threshold: null,
    desc: "Top contributor. Complimentary Pro and early feature access.",
  },
};

const EARN_ACTIONS = [
  { label: "Complete a trip", pts: "+100 pts", highlight: false },
  { label: "Add a hotel or property review", pts: "+50 pts", highlight: false },
  { label: "Submit a restaurant or activity tip", pts: "+25 pts", highlight: false },
  { label: "Upload a tagged photo", pts: "+15 pts", highlight: false },
  { label: "Your tip saved by another family", pts: "+10 pts bonus", highlight: false },
  { label: "Refer a friend who joins", pts: "+75 pts", highlight: false },
  { label: "Import camera roll", pts: "+500 pts", highlight: true },
  { label: "Complete a destination guide", pts: "+100 pts", highlight: false },
];

const PATH_NODES = [
  { key: "EXPLORER", initial: "E", label: "Explorer", perk: "Community access" },
  { key: "NAVIGATOR", initial: "N", label: "Navigator", perk: "Verified badge + priority placement" },
  { key: "PIONEER", initial: "P", label: "Pioneer", perk: "Complimentary Pro membership" },
];

const TIER_ORDER: Record<string, number> = { EXPLORER: 0, NAVIGATOR: 1, PIONEER: 2 };

// ── Tier Card ───────────────────────────────────────────────────────────────

function TierCard() {
  // Hardcoded for now — wire to real data in a follow-up
  const currentTier: "EXPLORER" | "NAVIGATOR" | "PIONEER" = "EXPLORER";
  const currentPoints = 0;

  const cfg = TIER_CONFIG[currentTier as keyof typeof TIER_CONFIG];
  const tierIndex = TIER_ORDER[currentTier];

  let progressPct = 0;
  let pointsLabel = `${currentPoints} points`;
  let thresholdLabel = "";
  const isPioneer = (currentTier as string) === "PIONEER";

  if (currentTier === "EXPLORER") {
    progressPct = Math.min(currentPoints / 500, 1) * 100;
    thresholdLabel = "500 to Navigator";
  } else if (currentTier === "NAVIGATOR") {
    progressPct = Math.min((currentPoints - 500) / 1500, 1) * 100;
    thresholdLabel = "2,000 to Pioneer";
  } else {
    progressPct = 100;
  }

  return (
    <div style={cardStyle}>

      {/* Section A — Current tier */}
      <div>
        <p style={{ fontSize: "30px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>
          {cfg.label}
        </p>
        <p style={{ fontSize: "14px", color: "#717171", margin: "6px 0 0", lineHeight: 1.5 }}>
          {cfg.desc}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: "20px" }}>
        {!isPioneer ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#717171" }}>{pointsLabel}</span>
              <span style={{ fontSize: "12px", color: "#717171" }}>{thresholdLabel}</span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#F5F5F5", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{
                width: `max(${progressPct}%, 4px)`, height: "100%",
                backgroundColor: "#1B3A5C", borderRadius: "999px",
                transition: "width 0.5s ease",
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#717171" }}>Maximum tier reached</span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#F5F5F5", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", backgroundColor: "#C4664A", borderRadius: "999px" }} />
            </div>
          </>
        )}
      </div>

      {/* Section B — Earn points */}
      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "24px", paddingTop: "24px" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>
          How to earn points
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EARN_ACTIONS.map((action) => (
            <div
              key={action.label}
              style={{
                backgroundColor: action.highlight ? "rgba(196,102,74,0.08)" : "#F9F9F9",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                alignItems: action.highlight ? "flex-start" : "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "#1B3A5C", margin: 0 }}>
                  {action.label}
                </p>
                {action.highlight && (
                  <p style={{ fontSize: "12px", color: "#C4664A", margin: "2px 0 0" }}>
                    Pioneer tier fast track
                  </p>
                )}
              </div>
              <span style={{
                flexShrink: 0,
                fontSize: "12px", fontWeight: 600,
                padding: "3px 10px", borderRadius: "999px",
                backgroundColor: action.highlight ? "rgba(196,102,74,0.15)" : "rgba(27,58,92,0.08)",
                color: action.highlight ? "#C4664A" : "#1B3A5C",
                whiteSpace: "nowrap",
              }}>
                {action.pts}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section C — Your path */}
      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "24px", paddingTop: "24px" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 20px" }}>
          Your path
        </p>
        <div style={{ display: "flex", alignItems: "center" }}>
          {PATH_NODES.map((node, i) => {
            const nodeIndex = TIER_ORDER[node.key];
            const isActive = nodeIndex === tierIndex;
            const isPast = nodeIndex < tierIndex;
            const isLocked = nodeIndex > tierIndex;
            const isPioneerNode = node.key === "PIONEER";

            const circleBg = isLocked
              ? "#F5F5F5"
              : isPioneerNode && isActive
              ? "#C4664A"
              : "#1B3A5C";

            const circleStyle: React.CSSProperties = {
              width: "40px", height: "40px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              backgroundColor: isLocked ? "#F5F5F5" : circleBg,
              border: isLocked ? "2px solid #E8E8E8" : "none",
            };

            return (
              <div key={node.key} style={{ display: "contents" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                  <div style={circleStyle}>
                    <span style={{
                      fontSize: "14px", fontWeight: 700,
                      color: isLocked ? "#CCCCCC" : "#fff",
                    }}>
                      {node.initial}
                    </span>
                  </div>
                  <p style={{
                    fontSize: "12px", fontWeight: 600, margin: "8px 0 0", textAlign: "center",
                    color: isLocked ? "#CCCCCC" : "#1B3A5C",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: "80px",
                  }}>
                    {node.label}
                  </p>
                  <p style={{
                    fontSize: "11px", margin: "3px 0 0", textAlign: "center",
                    color: isLocked ? "#CCCCCC" : "#717171",
                    lineHeight: 1.4,
                    maxWidth: "100px",
                  }}>
                    {node.perk}
                  </p>
                </div>
                {i < PATH_NODES.length - 1 && (
                  <div style={{
                    flex: 1, height: "1px", margin: "0 12px",
                    marginBottom: "40px",
                    backgroundColor: TIER_ORDER[PATH_NODES[i + 1].key] <= tierIndex ? "#1B3A5C" : "#E8E8E8",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff", borderRadius: "12px",
  border: "1px solid #E8E8E8", padding: "32px",
};

// ── Stat Cards ─────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      ...cardStyle,
      padding: "32px",
      borderLeft: "4px solid #C4664A",
      display: "flex", flexDirection: "column", alignItems: "flex-start",
    }}>
      <p style={{ fontSize: "48px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "13px", color: "#717171", margin: "8px 0 0" }}>{label}</p>
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
        width: "56px", height: "56px", borderRadius: "50%",
        backgroundColor: circleBg, border: circleBorder,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {badge.icon}
      </div>
      <p style={{ fontSize: "12px", fontWeight: 500, textAlign: "center", color: badge.earned ? "#1B3A5C" : "#717171", margin: 0, lineHeight: 1.3 }}>{badge.name}</p>
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

  const placesSaved = data?.placesSaved ?? 0;
  const tripsTaken = data?.tripsTaken ?? 0;

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
      earned: data?.tier === "NAVIGATOR" || data?.tier === "PIONEER",
    },
    {
      name: "Pioneer",
      icon: <Award size={22} style={{ color: "#CCCCCC" }} />,
      earned: data?.tier === "PIONEER",
    },
  ];

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* A — Stat cards */}
      <div className="grid grid-cols-2 gap-6">
        <StatCard value={String(data?.tripsTaken ?? 0)} label="Trips taken" />
        <StatCard value={String(placesSaved)} label="Places saved" />
        <StatCard value={String(data?.countriesVisited ?? 0)} label="Countries visited" />
        <StatCard value={data?.avgTripLength != null ? String(data.avgTripLength) : "—"} label="Avg. trip length (days)" />
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
      <TierCard />

      {/* D — Badges */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Badges</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
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
            {i > 0 && <div style={{ borderTop: "1px solid #E8E8E8", margin: "16px 0" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "36px", fontWeight: 700, color: "#1B3A5C", minWidth: "48px" }}>{item.num}</span>
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
