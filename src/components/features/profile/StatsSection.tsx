"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bookmark, Globe,
  Map, Utensils, Star, Camera, Heart, Users,
  Layers, Compass, Navigation, Award,
  Copy,
} from "lucide-react";
import { calculateTravelStats, TOTAL_COUNTRIES, type TravelStats } from "@/lib/travel-stats";
import { getCountryFlag } from "@/lib/country-flags";
import { getTripCoverImage } from "@/lib/destination-images";
import { useCountUp } from "@/hooks/useCountUp";

interface StatsData {
  tripsTaken: number;
  placesSaved: number;
  countriesVisited: number;
  avgTripLength: number | null;
  tier: "EXPLORER" | "NAVIGATOR" | "PIONEER";
  points: number;
  trips?: { destinationCity: string | null; destinationCountry: string | null; status: string; startDate?: string | null; endDate?: string | null }[];
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
  { label: "Complete a trip", pts: "+100 pts" },
  { label: "Add a hotel or property review", pts: "+50 pts" },
  { label: "Submit a restaurant or activity tip", pts: "+25 pts" },
  { label: "Upload a tagged photo", pts: "+15 pts" },
  { label: "Your tip saved by another family", pts: "+10 pts bonus" },
  { label: "Refer a friend who joins", pts: "+75 pts" },
  { label: "Complete a destination guide", pts: "+100 pts" },
];

const PATH_NODES = [
  { key: "EXPLORER", initial: "E", label: "Explorer", perk: "Community access" },
  { key: "NAVIGATOR", initial: "N", label: "Navigator", perk: "Verified badge + priority placement" },
  { key: "PIONEER", initial: "P", label: "Pioneer", perk: "Complimentary Pro membership" },
];

const TIER_ORDER: Record<string, number> = { EXPLORER: 0, NAVIGATOR: 1, PIONEER: 2 };

const REGION_MAP: Record<string, string> = {
  "Japan": "East Asia", "South Korea": "East Asia", "Korea": "East Asia", "China": "East Asia", "Taiwan": "East Asia",
  "Thailand": "Southeast Asia", "Vietnam": "Southeast Asia", "Cambodia": "Southeast Asia", "Indonesia": "Southeast Asia",
  "Singapore": "Southeast Asia", "Malaysia": "Southeast Asia", "Philippines": "Southeast Asia",
  "India": "South Asia", "Sri Lanka": "South Asia", "Nepal": "South Asia", "Maldives": "South Asia",
  "France": "Western Europe", "Spain": "Western Europe", "Portugal": "Western Europe", "Italy": "Western Europe",
  "Germany": "Western Europe", "United Kingdom": "Western Europe", "UK": "Western Europe", "Netherlands": "Western Europe",
  "Belgium": "Western Europe", "Switzerland": "Western Europe", "Austria": "Western Europe", "Ireland": "Western Europe",
  "Greece": "Southern Europe", "Croatia": "Southern Europe", "Turkey": "Southern Europe",
  "Czech Republic": "Central Europe", "Poland": "Central Europe", "Hungary": "Central Europe",
  "Sweden": "Scandinavia", "Norway": "Scandinavia", "Denmark": "Scandinavia", "Iceland": "Scandinavia",
  "Morocco": "North Africa", "Egypt": "North Africa", "Tunisia": "North Africa",
  "South Africa": "Sub-Saharan Africa", "Kenya": "Sub-Saharan Africa", "Tanzania": "Sub-Saharan Africa",
  "UAE": "Middle East", "United Arab Emirates": "Middle East", "Qatar": "Middle East", "Israel": "Middle East", "Jordan": "Middle East",
  "United States": "North America", "USA": "North America", "Canada": "North America",
  "Mexico": "Central America", "Costa Rica": "Central America", "Cuba": "Caribbean",
  "Brazil": "South America", "Argentina": "South America", "Peru": "South America", "Colombia": "South America", "Chile": "South America",
  "Australia": "Oceania", "New Zealand": "Oceania",
};

function getRegions(countries: { country: string }[]): string[] {
  const regions = new Set(countries.map((c) => REGION_MAP[c.country] ?? "Other"));
  return Array.from(regions);
}

// ── Tier Card ───────────────────────────────────────────────────────────────

function TierCard() {
  const currentTier: "EXPLORER" | "NAVIGATOR" | "PIONEER" = "EXPLORER";
  const currentPoints = 0;

  const cfg = TIER_CONFIG[currentTier];
  const tierIndex = TIER_ORDER[currentTier];
  const isPioneer = (currentTier as string) === "PIONEER";

  let progressPct = 0;
  let pointsLabel = `${currentPoints} points`;
  let thresholdLabel = "";

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
      <div>
        <p style={{ fontSize: "30px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>{cfg.label}</p>
        <p style={{ fontSize: "14px", color: "#717171", margin: "6px 0 0", lineHeight: 1.5 }}>{cfg.desc}</p>
      </div>

      <div style={{ marginTop: "20px" }}>
        {!isPioneer ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "#717171" }}>{pointsLabel}</span>
              <span style={{ fontSize: "12px", color: "#717171" }}>{thresholdLabel}</span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#F5F5F5", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{ width: `max(${progressPct}%, 4px)`, height: "100%", backgroundColor: "#1B3A5C", borderRadius: "999px", transition: "width 0.5s ease" }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "6px" }}><span style={{ fontSize: "12px", color: "#717171" }}>Maximum tier reached</span></div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#F5F5F5", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", backgroundColor: "#C4664A", borderRadius: "999px" }} />
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "24px", paddingTop: "24px" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>How to earn points</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EARN_ACTIONS.map((action) => (
            <div key={action.label} style={{ backgroundColor: "#F9F9F9", borderRadius: "8px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#1B3A5C", margin: 0 }}>{action.label}</p>
              <span style={{ flexShrink: 0, fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", backgroundColor: "rgba(27,58,92,0.08)", color: "#1B3A5C", whiteSpace: "nowrap" }}>{action.pts}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
          <div style={{ backgroundColor: "rgba(196,102,74,0.06)", borderRadius: "8px", padding: "16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", border: "1px solid rgba(196,102,74,0.15)" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Import a past trip from camera roll</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0" }}>Unlock memories and let Flokk build a trip from your photos.</p>
            </div>
            <span style={{ flexShrink: 0, fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", backgroundColor: "rgba(196,102,74,0.15)", color: "#C4664A", whiteSpace: "nowrap" }}>+300 pts</span>
          </div>
          <div style={{ backgroundColor: "rgba(196,102,74,0.08)", borderRadius: "8px", padding: "16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", border: "1px solid rgba(196,102,74,0.2)" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Enable live capture for a current trip</p>
              <p style={{ fontSize: "12px", color: "#C4664A", margin: "2px 0 0" }}>Pioneer tier fast track</p>
            </div>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", whiteSpace: "nowrap" }}>Most points</span>
              <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", backgroundColor: "rgba(196,102,74,0.15)", color: "#C4664A", whiteSpace: "nowrap" }}>+500 pts</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #E8E8E8", marginTop: "24px", paddingTop: "24px" }}>
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 20px" }}>Your path</p>
        <div style={{ display: "flex", alignItems: "center" }}>
          {PATH_NODES.map((node, i) => {
            const nodeIndex = TIER_ORDER[node.key];
            const isLocked = nodeIndex > tierIndex;
            const isPioneerNode = node.key === "PIONEER";
            const circleBg = isLocked ? "#F5F5F5" : isPioneerNode ? "#C4664A" : "#1B3A5C";
            return (
              <div key={node.key} style={{ display: "contents" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: circleBg, border: isLocked ? "2px solid #E8E8E8" : "none" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: isLocked ? "#CCCCCC" : "#fff" }}>{node.initial}</span>
                  </div>
                  <p style={{ fontSize: "12px", fontWeight: 600, margin: "8px 0 0", textAlign: "center", color: isLocked ? "#CCCCCC" : "#1B3A5C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80px" }}>{node.label}</p>
                  <p style={{ fontSize: "11px", margin: "3px 0 0", textAlign: "center", color: isLocked ? "#CCCCCC" : "#717171", lineHeight: 1.4, maxWidth: "100px" }}>{node.perk}</p>
                </div>
                {i < PATH_NODES.length - 1 && (
                  <div style={{ flex: 1, height: "1px", margin: "0 12px", marginBottom: "40px", backgroundColor: TIER_ORDER[PATH_NODES[i + 1].key] <= tierIndex ? "#1B3A5C" : "#E8E8E8" }} />
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
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: circleBg, border: circleBorder, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {badge.icon}
      </div>
      <p style={{ fontSize: "12px", fontWeight: 500, textAlign: "center", color: badge.earned ? "#1B3A5C" : "#717171", margin: 0, lineHeight: 1.3 }}>{badge.name}</p>
      <p style={{ fontSize: "10px", color: "#717171", textAlign: "center", margin: 0 }}>{badge.earned ? (badge.earnedDate ?? "Earned") : "Locked"}</p>
    </div>
  );
}

// ── Memory Board — Populated State ──────────────────────────────────────────

function MemoryBoard({ stats }: { stats: TravelStats }) {
  const tripsCount = useCountUp(stats.totalTrips, 1200);
  const countriesCount = useCountUp(stats.totalCountries, 1400);
  const citiesCount = useCountUp(stats.totalCities, 1600);
  const daysCount = useCountUp(stats.totalDays ?? 0, 1800);

  const milestones = [5, 10, 15, 20, 30, 50, 100];
  const nextMilestone = milestones.find((m) => m > stats.totalCountries) ?? 100;
  const prevMilestone = milestones[milestones.indexOf(nextMilestone) - 1] ?? 0;
  const milestonePct = nextMilestone === prevMilestone ? 100
    : Math.round(((stats.totalCountries - prevMilestone) / (nextMilestone - prevMilestone)) * 100);
  const remaining = nextMilestone - stats.totalCountries;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── HERO ANIMATED COUNTERS ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Top row: Trips + Countries */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ backgroundColor: "#1B3A5C", borderRadius: "16px", padding: "22px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>✈️</div>
            <p style={{ fontSize: "48px", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {tripsCount}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "7px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Trips taken
            </p>
          </div>
          <div style={{ backgroundColor: "#C4664A", borderRadius: "16px", padding: "22px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🌍</div>
            <p style={{ fontSize: "48px", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {countriesCount}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "7px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Countries
            </p>
          </div>
        </div>
        {/* Bottom row: Cities + Days */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div style={{ backgroundColor: "#2d5a8e", borderRadius: "16px", padding: "18px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "40px", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {citiesCount}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "7px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Cities
            </p>
          </div>
          <div style={{ backgroundColor: "#163054", borderRadius: "16px", padding: "18px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "40px", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {daysCount > 0 ? daysCount : stats.percentOfWorld}
              {daysCount === 0 && <span style={{ fontSize: "28px" }}>%</span>}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "7px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {daysCount > 0 ? "Days abroad" : "Of the world"}
            </p>
          </div>
        </div>
      </div>

      {/* ── PASSPORT STAMPS ── */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #E8E8E8", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}>Your passport stamps</p>
            <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0" }}>Countries you&apos;ve explored</p>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, backgroundColor: "#1B3A5C", color: "#fff", borderRadius: "999px", padding: "4px 12px" }}>
            {stats.totalCountries} stamped
          </span>
        </div>

        <div
          style={{ display: "flex", gap: "12px", overflowX: "auto", padding: "0 18px 18px", scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="hide-scrollbar"
        >
          {stats.countriesVisited.map((c) => {
            const coverImage = getTripCoverImage(c.cities[0] ?? null, c.country, null);
            return (
              <div
                key={c.country}
                style={{ flexShrink: 0, width: "180px", borderRadius: "14px", overflow: "hidden", border: "1px solid #E8E8E8", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
              >
                {/* Destination image with overlays */}
                <div style={{ height: "130px", position: "relative", backgroundColor: "#1B3A5C", overflow: "hidden" }}>
                  <img
                    src={coverImage}
                    alt={c.country}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Dark overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)" }} />
                  {/* Passport stamp */}
                  <div style={{ position: "absolute", top: "10px", right: "10px", width: "40px", height: "40px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)", backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "22px", lineHeight: 1 }}>{getCountryFlag(c.country)}</span>
                  </div>
                  {/* Country info */}
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.2 }}>{c.country}</p>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", margin: "3px 0 0", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.cities.join(" · ")}
                    </p>
                  </div>
                </div>

                {/* Stats bar */}
                <div style={{ padding: "10px 12px", backgroundColor: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ flex: 1, marginRight: "8px" }}>
                      <div style={{ width: "100%", height: "5px", backgroundColor: "#F0F0F0", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ width: `max(${c.percent}%, 3px)`, height: "100%", backgroundColor: "#1B3A5C", borderRadius: "999px" }} />
                      </div>
                      <p style={{ fontSize: "9px", color: "#AAAAAA", margin: "3px 0 0" }}>{c.percent}% of major cities</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: "18px", fontWeight: 800, color: "#1B3A5C", margin: 0, lineHeight: 1 }}>{c.cityCount}</p>
                      <p style={{ fontSize: "9px", color: "#717171", margin: "1px 0 0" }}>{c.cityCount === 1 ? "city" : "cities"}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── WORLD EXPLORED BAR ── */}
      <div style={{ background: "linear-gradient(135deg, #1B3A5C 0%, #163054 100%)", borderRadius: "16px", padding: "22px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>World explored</p>
            <p style={{ fontSize: "38px", fontWeight: 900, color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>
              {stats.percentOfWorld}%
            </p>
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", textAlign: "right", lineHeight: 1.6 }}>
            {stats.totalCountries} of {TOTAL_COUNTRIES}<br />countries visited
          </p>
        </div>
        <div style={{ width: "100%", height: "12px", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `max(${stats.percentOfWorld > 0 ? "4px" : "0px"}, ${stats.percentOfWorld}%)`, height: "100%", backgroundColor: "#C4664A", borderRadius: "999px", transition: "width 0.8s ease" }} />
        </div>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "8px 0 0" }}>
          Keep going — there&apos;s so much left to discover
        </p>
      </div>

      {/* ── REGIONS EXPLORED ── */}
      {stats.countriesVisited.length > 0 && (
        <div style={cardStyle}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>Regions explored</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {getRegions(stats.countriesVisited).map((region) => (
              <span
                key={region}
                style={{ display: "inline-block", padding: "6px 14px", backgroundColor: "rgba(27,58,92,0.07)", color: "#1B3A5C", borderRadius: "999px", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(27,58,92,0.12)" }}
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── NEXT MILESTONE ── */}
      <div style={{ ...cardStyle, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#AAAAAA", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Next milestone</p>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}>
              {remaining} more {remaining === 1 ? "country" : "countries"} to go
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "32px", fontWeight: 900, color: "#C4664A", margin: 0, lineHeight: 1 }}>{nextMilestone}</p>
            <p style={{ fontSize: "11px", color: "#717171", margin: "2px 0 0" }}>countries</p>
          </div>
        </div>
        <div style={{ width: "100%", height: "10px", backgroundColor: "#F0F0F0", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ width: `max(${milestonePct}%, 4px)`, height: "100%", backgroundColor: "#C4664A", borderRadius: "999px", transition: "width 0.8s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
          <span style={{ fontSize: "11px", color: "#CCCCCC" }}>{prevMilestone} countries</span>
          <span style={{ fontSize: "11px", color: "#CCCCCC" }}>{nextMilestone} countries</span>
        </div>
      </div>

      {/* ── ADD MORE TRIPS ── */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(27,58,92,0.03) 0%, rgba(196,102,74,0.03) 100%)", textAlign: "center", padding: "28px 24px" }}>
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>🗺️</div>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 6px" }}>
          Been somewhere not on your map?
        </p>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 18px", lineHeight: 1.6 }}>
          Add past trips to unlock more stamps, earn Pioneer points,<br />
          and help families planning the same destinations.
        </p>
        <Link
          href="/trips/past/new"
          style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "10px 22px", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}
        >
          + Add a past trip
        </Link>
      </div>
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────────────

export function StatsSection() {
  const [data, setData] = useState<StatsData | null>(null);
  const [travelStats, setTravelStats] = useState<TravelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteUrl = "https://flokktravel.com/invite/your-link";
  const today = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (Array.isArray(d.trips)) setTravelStats(calculateTravelStats(d.trips));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCopy() {
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const placesSaved = data?.placesSaved ?? 0;
  const tripsTaken = data?.tripsTaken ?? 0;

  const badges: BadgeDef[] = [
    { name: "First Save", icon: <Bookmark size={22} style={{ color: placesSaved > 0 ? "#1B3A5C" : "#CCCCCC" }} />, earned: placesSaved > 0, earnedDate: placesSaved > 0 ? today : undefined },
    { name: "Trip Planner", icon: <Map size={22} style={{ color: tripsTaken > 0 ? "#1B3A5C" : "#CCCCCC" }} />, earned: tripsTaken > 0, earnedDate: tripsTaken > 0 ? today : undefined },
    { name: "Bon Vivant", icon: <Utensils size={22} style={{ color: "#CCCCCC" }} />, earned: false },
    { name: "World Citizen", icon: <Globe size={22} style={{ color: "#CCCCCC" }} />, earned: false },
    { name: "Founding Contributor", icon: <Star size={22} style={{ color: "#C4664A" }} />, earned: true, earnedDate: "Beta", isFounder: true },
    { name: "Memory Keeper", icon: <Camera size={22} style={{ color: "#CCCCCC" }} />, earned: false },
    { name: "Community Gem", icon: <Heart size={22} style={{ color: "#CCCCCC" }} />, earned: false },
    { name: "Pack Leader", icon: <Users size={22} style={{ color: "#CCCCCC" }} />, earned: false },
    { name: "50 Saves", icon: <Layers size={22} style={{ color: placesSaved >= 50 ? "#1B3A5C" : "#CCCCCC" }} />, earned: placesSaved >= 50, earnedDate: placesSaved >= 50 ? today : undefined },
    { name: "Explorer", icon: <Compass size={22} style={{ color: "#1B3A5C" }} />, earned: true, earnedDate: today },
    { name: "Navigator", icon: <Navigation size={22} style={{ color: "#CCCCCC" }} />, earned: data?.tier === "NAVIGATOR" || data?.tier === "PIONEER" },
    { name: "Pioneer", icon: <Award size={22} style={{ color: "#CCCCCC" }} />, earned: data?.tier === "PIONEER" },
  ];

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* A — Memory board or empty state */}
      {!travelStats || travelStats.totalTrips === 0 ? (
        /* ── EMPTY STATE ── */
        <div style={{ background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)", borderRadius: "16px", textAlign: "center", padding: "52px 32px" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>🌍</div>
          <p style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.2 }}>
            Your passport is empty
          </p>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.72)", margin: "0 0 8px", lineHeight: 1.7 }}>
            Add your past trips to start collecting stamps,<br />
            track how much of the world you&apos;ve explored,<br />
            and show your kids everywhere you&apos;ve been.
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: "0 0 24px" }}>
            Every trip earns Pioneer tier points
          </p>
          <Link
            href="/trips/past/new"
            style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "12px 28px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}
          >
            Add your first past trip →
          </Link>
        </div>
      ) : (
        /* ── POPULATED — MEMORY BOARD ── */
        <MemoryBoard stats={travelStats} />
      )}

      {/* B — Tier progress */}
      <TierCard />

      {/* C — Badges */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Badges</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-6">
          {badges.map((b) => <Badge key={b.name} badge={b} />)}
        </div>
      </div>

      {/* D — Community impact */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>Your impact</p>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 20px" }}>How your saves and trips have helped other families.</p>
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

      {/* E — Invite */}
      <div style={cardStyle}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>Invite friends</p>
        <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 16px" }}>Know a family who&apos;d love Flokk? Invite them.</p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="friend@email.com"
            type="email"
            style={{ flex: 1, padding: "9px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: "#1a1a1a", outline: "none" }}
          />
          <button style={{ backgroundColor: "#1B3A5C", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontSize: "13px", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
            Send invite
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 8px" }}>Or share your invite link</p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            readOnly
            value={inviteUrl}
            style={{ flex: 1, padding: "9px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "13px", color: "#717171", backgroundColor: "#F9F9F9", outline: "none" }}
          />
          <button
            onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: copied ? "#1B3A5C" : "#C4664A", whiteSpace: "nowrap", padding: "4px 0" }}
          >
            <Copy size={14} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
