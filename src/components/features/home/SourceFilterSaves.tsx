"use client";

import { useState } from "react";
import { Instagram, Play, Youtube, Link as LinkIcon, Mail } from "lucide-react";
import { RecentSavesCards, type RecentSaveItem } from "./RecentSavesCards";
import { DropLinkModal } from "./DropLinkModal";

type SourceFilter = "ALL" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "MANUAL";

const SOURCE_PILLS: { label: string; filter: SourceFilter; icon: React.ReactNode; color: string }[] = [
  { label: "Instagram", filter: "INSTAGRAM", icon: <Instagram size={13} style={{ color: "#E1306C" }} />, color: "#E1306C" },
  { label: "TikTok",    filter: "TIKTOK",    icon: <Play size={13} style={{ color: "#010101" }} />,    color: "#010101" },
  { label: "YouTube",   filter: "YOUTUBE",   icon: <Youtube size={13} style={{ color: "#FF0000" }} />,  color: "#FF0000" },
];

export type SourceSaveItem = RecentSaveItem & { sourceType: string };

export function SourceFilterSaves({
  items,
  trips,
  itineraryItemCount = 1,
}: {
  items: SourceSaveItem[];
  trips: { id: string; title: string; startDate: string | null; endDate: string | null; status?: string }[];
  itineraryItemCount?: number;
}) {
  const [filter, setFilter] = useState<SourceFilter>("ALL");
  const [dropLinkOpen, setDropLinkOpen] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [tipDismissed, setTipDismissed] = useState(false);

  function handleDelete(id: string) {
    setDeletedIds(prev => new Set([...prev, id]));
    fetch(`/api/saves/${id}`, { method: "DELETE" }).catch(e => console.error("[delete save]", e));
  }

  const filtered = items.filter(item => !deletedIds.has(item.id));

  // Show at most 6, already deduped by caller
  const visible = filtered.slice(0, 6);

  return (
    <>
      {/* Where do you find travel ideas? */}
      <div style={{ backgroundColor: "#F5F5F5", border: "1px solid rgba(196,102,74,0.18)", borderRadius: "16px", padding: "16px" }}>
        <p style={{ fontWeight: 700, fontSize: "14px", color: "#1a1a1a", marginBottom: "4px" }}>Where do you find travel ideas?</p>
        <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "12px" }}>
          Share anything from these apps directly to Flokk — we&apos;ll pull out the location, details, and context automatically.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {SOURCE_PILLS.map(({ label, filter: f, icon }) => {
            const active = filter === f;
            return (
              <button
                key={label}
                onClick={() => setFilter(active ? "ALL" : f)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600,
                  border: active ? "1.5px solid #C4664A" : "1px solid rgba(196,102,74,0.25)",
                  color: active ? "#C4664A" : "#717171",
                  backgroundColor: active ? "rgba(196,102,74,0.08)" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {icon}
                {label}
              </button>
            );
          })}
          <button
            onClick={() => setDropLinkOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(196,102,74,0.25)", color: "#717171", backgroundColor: "#fff", cursor: "pointer" }}
          >
            <LinkIcon size={13} style={{ color: "#717171" }} />
            Anywhere else →
          </button>
        </div>

        {filter !== "ALL" && (
          <div className="mt-3 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 flex items-start gap-3">
            <LinkIcon size={16} className="text-[#C4664A] mt-0.5 shrink-0" />
            <div>
              {filter === "INSTAGRAM" && "Open any Instagram post, tap the three dots, select Copy Link, then paste it into Drop a Link below."}
              {filter === "TIKTOK" && "On any TikTok, tap Share, then Copy Link. Paste it into Drop a Link below."}
              {filter === "YOUTUBE" && "Open any YouTube video, tap Share, then Copy Link. Paste it into Drop a Link below."}
              <button
                onClick={() => setDropLinkOpen(true)}
                className="text-[#C4664A] text-sm font-medium mt-2 block"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
              >
                Open Drop a Link →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email forwarding tip — shown only when user has no imported bookings */}
      {itineraryItemCount === 0 && !tipDismissed && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "14px 16px",
          marginTop: "16px",
          backgroundColor: "#FDF6F4",
          borderLeft: "3px solid #C4664A",
          borderRadius: "8px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
            <Mail size={16} style={{ color: "#C4664A", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "13px", color: "#1B3A5C", lineHeight: 1.5 }}>
              Forward any hotel, flight, or activity confirmation to{" "}
              <span style={{ fontWeight: 600, color: "#C4664A" }}>trips@flokktravel.com</span>
              {" "}and we&apos;ll file it into your trip automatically.
            </p>
          </div>
          <button
            onClick={() => setTipDismissed(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#AAAAAA",
              fontSize: "18px",
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Filtered recent saves */}
      <div style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ fontWeight: 700, color: "#1a1a1a", fontSize: "15px" }}>Recent saves</h2>
          <a href="/saves" style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}>See all</a>
        </div>
        {visible.length > 0 ? (
          <RecentSavesCards items={visible} onDelete={handleDelete} />
        ) : (
          <p style={{ fontSize: "13px", color: "#aaa", padding: "16px 0" }}>No saves yet.</p>
        )}
      </div>

      {dropLinkOpen && (
        <DropLinkModal
          trips={trips}
          onClose={() => setDropLinkOpen(false)}
          onSaved={() => setDropLinkOpen(false)}
        />
      )}
    </>
  );
}
