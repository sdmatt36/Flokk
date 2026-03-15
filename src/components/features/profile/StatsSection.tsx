"use client";

import { useState, useEffect, useRef } from "react";
import { Copy } from "lucide-react";

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
    bg: "#F5F5F5",
    color: "#717171",
    desc: "You're just getting started. Keep saving and contributing to level up.",
  },
  NAVIGATOR: {
    label: "Navigator",
    bg: "rgba(27,58,92,0.1)",
    color: "#1B3A5C",
    desc: "You're a consistent contributor. Premium features unlocked.",
  },
  PIONEER: {
    label: "Pioneer",
    bg: "rgba(196,102,74,0.1)",
    color: "#C4664A",
    desc: "Top contributor. Priority placement, early access, and complimentary Pro.",
  },
};

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8",
      padding: "24px", textAlign: "center",
    }}>
      <p style={{ fontSize: "36px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "13px", color: "#717171", marginTop: "6px", marginBottom: 0 }}>{label}</p>
    </div>
  );
}

export function StatsSection() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const inviteUrl = "https://flokktravel.com/invite/your-link";

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
  const tierCfg = TIER_CONFIG[tier];

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="grid grid-cols-2 gap-4">
        <StatCard value={String(data?.tripsTaken ?? 0)} label="Trips taken" />
        <StatCard value={String(data?.placesSaved ?? 0)} label="Places saved" />
        <StatCard value={String(data?.countriesVisited ?? 0)} label="Countries visited" />
        <StatCard
          value={data?.avgTripLength != null ? `${data.avgTripLength}` : "—"}
          label="Avg. trip length (days)"
        />
      </div>

      {/* Gamification */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", marginBottom: "16px", marginTop: 0 }}>
          Gamification
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <span style={{
            padding: "8px 24px", borderRadius: "999px", fontSize: "14px", fontWeight: 600,
            backgroundColor: tierCfg.bg, color: tierCfg.color,
          }}>
            {tierCfg.label}
          </span>
          <p style={{ fontSize: "14px", color: "#717171", textAlign: "center", margin: 0 }}>
            {tierCfg.desc}
          </p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}>
            {data?.points ?? 0}
          </p>
          <p style={{ fontSize: "13px", color: "#717171", margin: 0 }}>contribution points</p>
        </div>
      </div>

      {/* Invite */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", padding: "24px" }}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", marginBottom: "4px", marginTop: 0 }}>
          Invite friends
        </p>
        <p style={{ fontSize: "14px", color: "#717171", marginBottom: "16px", marginTop: 0 }}>
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
        <p style={{ fontSize: "13px", color: "#717171", marginBottom: "8px", marginTop: 0 }}>
          Or share your invite link
        </p>
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
