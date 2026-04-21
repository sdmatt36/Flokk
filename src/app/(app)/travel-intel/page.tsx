"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, MapPin } from "lucide-react";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

// ── Types ─────────────────────────────────────────────────────────────────────

type GuideItem = {
  id: string;
  kind: "article" | "video";
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  destination: string | null;
  ageGroup: string | null;
  contentType: string;
  isFlokk: boolean;
  tags: string[];
  submittedAt: string | null;
  publicationDate: string | null;
};

type FilterType = "All" | "Articles" | "Videos" | "Guides";

const TOPIC_TAGS = ["Packing", "Disney", "Budget", "Food", "Adventure", "Culture", "Safety", "Flights", "Hotels", "Theme Parks", "Road Trips", "Holiday Markets", "Food Markets", "Cruises"] as const;
type TopicTag = typeof TOPIC_TAGS[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBadge(item: GuideItem): string {
  const ct = item.contentType?.toLowerCase() ?? "";
  if (item.kind === "video" || ct === "video" || ct === "creator") return "Video";
  if (ct === "guide") return "Guide";
  return "Article";
}


function matchesFilter(item: GuideItem, filter: FilterType): boolean {
  if (filter === "All") return true;
  const badge = getBadge(item);
  if (filter === "Articles") return badge === "Article";
  if (filter === "Videos") return badge === "Video";
  if (filter === "Guides") return badge === "Guide";
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSubmittedAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return null; }
}

function formatPublicationDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return null; }
}

function safeHref(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function GuideCard({ item }: { item: GuideItem }) {
  const [hovered, setHovered] = useState(false);
  const badge = getBadge(item);
  const isVideo = badge === "Video";
  const href = safeHref(item.url);
  const ageGroups = item.ageGroup && item.ageGroup !== "all"
    ? item.ageGroup.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const card = (
    <>
      {/* 16:9 thumbnail */}
      <div style={{ position: "relative", paddingTop: "56.25%", backgroundColor: "#F0F0F0", overflow: "hidden", flexShrink: 0 }}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1B3A5C 0%, #2d5a8e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!isVideo && <span style={{ fontSize: "36px" }}>📄</span>}
          </div>
        )}
        {/* Video play overlay */}
        {isVideo && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: hovered ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.18s ease",
            }}>
              <div style={{ width: 0, height: 0, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", borderLeft: "16px solid #C4664A", marginLeft: "4px" }} />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
        <span style={{ display: "inline-block", alignSelf: "flex-start", fontSize: "11px", fontWeight: 700, color: "#fff", backgroundColor: "#1B3A5C", borderRadius: "999px", padding: "2px 10px", marginBottom: "8px" }}>
          {badge}
        </span>
        <p className={playfair.className} style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", marginBottom: "4px", lineHeight: 1.3 }}>{item.title}</p>
        {item.destination && (
          <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "6px" }}>
            <MapPin size={11} style={{ color: "#AAAAAA", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#AAAAAA" }}>{item.destination}</span>
          </div>
        )}
        {ageGroups.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {ageGroups.map((ag) => (
              <span key={ag} style={{ fontSize: "11px", color: "#717171", backgroundColor: "#F5F5F5", borderRadius: "999px", padding: "2px 8px" }}>{ag}</span>
            ))}
          </div>
        )}
        {item.description && (
          <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
            {item.description}
          </p>
        )}
        <div style={{ marginTop: "auto", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {formatPublicationDate(item.publicationDate) && (
            <span style={{ fontSize: "11px", color: "#AAAAAA" }}>Published {formatPublicationDate(item.publicationDate)}</span>
          )}
          {formatSubmittedAt(item.submittedAt) && (
            <span style={{ fontSize: "11px", color: "#CCCCCC" }}>Submitted {formatSubmittedAt(item.submittedAt)}</span>
          )}
        </div>
      </div>
    </>
  );

  const sharedStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid #EEEEEE",
    boxShadow: hovered ? "0 8px 28px rgba(0,0,0,0.13)" : "0 1px 8px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    transition: "box-shadow 0.18s ease",
    textDecoration: "none",
    cursor: href ? "pointer" : "default",
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={sharedStyle}
      >
        {card}
      </a>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={sharedStyle}
    >
      {card}
    </div>
  );
}

// ── Submit Modal ──────────────────────────────────────────────────────────────

type OgPreview = { title: string | null; imageUrl: string | null; description: string | null };

function getSiteName(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitType, setSubmitType] = useState("Article");
  const [submitDest, setSubmitDest] = useState("");
  const [submitDestSuggs, setSubmitDestSuggs] = useState<{cityName: string; countryName: string; placeId?: string}[]>([]);
  const submitDestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitAgeGroups, setSubmitAgeGroups] = useState<string[]>(["All ages"]);
  const [submitTags, setSubmitTags] = useState<string[]>([]);
  const [submitNote, setSubmitNote] = useState("");
  const [submitPublicationDate, setSubmitPublicationDate] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [ogData, setOgData] = useState<OgPreview | null>(null);
  const [ogLoading, setOgLoading] = useState(false);

  useEffect(() => {
    if (submitDestDebounceRef.current) clearTimeout(submitDestDebounceRef.current);
    if (submitDest.length < 2) { setSubmitDestSuggs([]); return; }
    submitDestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(submitDest)}`);
        const data = await res.json();
        setSubmitDestSuggs(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch { setSubmitDestSuggs([]); }
    }, 300);
    return () => { if (submitDestDebounceRef.current) clearTimeout(submitDestDebounceRef.current); };
  }, [submitDest]);

  async function handleUrlBlur() {
    const url = submitUrl.trim();
    if (!url || !url.startsWith("http")) return;
    // Auto-detect video URLs
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) setSubmitType("Video");
    setOgLoading(true);
    setOgData(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as OgPreview & { error?: string };
      if (!data.error) {
        setOgData({ title: data.title, imageUrl: data.imageUrl, description: data.description });
        if (!submitNote.trim() && data.description) setSubmitNote(data.description);
      }
    } catch { /* ignore */ } finally {
      setOgLoading(false);
    }
  }

  const canSubmit = submitUrl.trim() && submitDest.trim() && !submitLoading;

  async function handleSubmit() {
    if (!canSubmit) { setSubmitError("URL and destination are required."); return; }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const ageGroup = submitAgeGroups.includes("All ages") ? "all" : submitAgeGroups.join(",");
      const res = await fetch("/api/content/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: submitUrl.trim(),
          contentType: submitType.toLowerCase(),
          destination: submitDest.trim(),
          ageGroup,
          tags: submitTags,
          description: submitNote.trim() || null,
          ogTitle: ogData?.title ?? null,
          ogImageUrl: ogData?.imageUrl ?? null,
          ogDescription: ogData?.description ?? null,
          publicationDate: submitPublicationDate.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setSubmitError(d.error ?? "Failed to submit. Please try again.");
        return;
      }
      setSubmitDone(true);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 600, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
          <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Submit</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", padding: "4px", lineHeight: 1 }}>
            <X size={20} />
          </button>
        </div>

        {submitDone ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✓</div>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#1B3A5C", marginBottom: "6px" }}>Thanks for sharing!</p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5 }}>We&apos;ll review and publish within 48 hours.</p>
            <button
              onClick={onClose}
              style={{ marginTop: "20px", padding: "11px 28px", borderRadius: "12px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* URL */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>URL *</label>
                <input
                  type="url"
                  value={submitUrl}
                  onChange={(e) => { setSubmitUrl(e.target.value); setOgData(null); }}
                  onBlur={handleUrlBlur}
                  placeholder="Paste a link to an article, video or guide..."
                  style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                />
                {ogLoading && (
                  <p style={{ fontSize: "12px", color: "#AAAAAA", marginTop: "8px" }}>Fetching preview…</p>
                )}
                {!ogLoading && ogData && (submitUrl.startsWith("http")) && (
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", backgroundColor: "#F9F9F9", borderRadius: "10px", border: "1px solid #EEEEEE" }}>
                      {ogData.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ogData.imageUrl} alt="" style={{ width: "56px", height: "42px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {ogData.title && <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{ogData.title}</p>}
                        <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "2px 0 0" }}>{getSiteName(submitUrl)}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "5px" }}>This is what will appear on Travel Intel</p>
                  </div>
                )}
              </div>

              {/* Content type */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Content type *</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["Article", "Video", "Guide", "Other"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSubmitType(t)}
                      style={{ padding: "7px 16px", borderRadius: "999px", border: "1.5px solid", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: submitType === t ? "#C4664A" : "#E8E8E8", backgroundColor: submitType === t ? "#C4664A" : "#fff", color: submitType === t ? "#fff" : "#717171" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div style={{ position: "relative" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Destination *</label>
                <input
                  type="text"
                  value={submitDest}
                  onChange={(e) => setSubmitDest(e.target.value)}
                  placeholder="e.g. Seoul, Japan, Kyoto..."
                  style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                />
                {submitDestSuggs.length > 0 && submitDest && (
                  <div style={{ position: "absolute", top: "calc(100% - 6px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E8E8E8", borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 10, overflow: "hidden" }}>
                    {submitDestSuggs.map((s) => (
                      <button
                        key={s.placeId ?? `${s.cityName}-${s.countryName}`}
                        type="button"
                        onMouseDown={() => { setSubmitDest(s.countryName ? `${s.cityName}, ${s.countryName}` : s.cityName); setSubmitDestSuggs([]); }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                      >
                        <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                        <span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.cityName}</span>
                          {s.countryName && s.countryName !== s.cityName && (
                            <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>· {s.countryName}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Age group */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Age group relevance</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {["All ages", "Under 5", "5–8", "8–12", "Teens"].map((ag) => {
                    const active = submitAgeGroups.includes(ag);
                    return (
                      <button
                        key={ag}
                        type="button"
                        onClick={() => {
                          if (ag === "All ages") {
                            setSubmitAgeGroups(["All ages"]);
                          } else {
                            setSubmitAgeGroups((prev) => {
                              const without = prev.filter((x) => x !== "All ages");
                              return active ? (without.filter((x) => x !== ag).length ? without.filter((x) => x !== ag) : ["All ages"]) : [...without, ag];
                            });
                          }
                        }}
                        style={{ padding: "6px 14px", borderRadius: "999px", border: "1.5px solid", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderColor: active ? "#1B3A5C" : "#E8E8E8", backgroundColor: active ? "#1B3A5C" : "#fff", color: active ? "#fff" : "#717171" }}
                      >
                        {ag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic tags */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "8px" }}>Topics <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {TOPIC_TAGS.map((tag) => {
                    const active = submitTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSubmitTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                        style={{ padding: "5px 12px", borderRadius: "999px", border: "1.5px solid", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderColor: active ? "#C4664A" : "#E8E8E8", backgroundColor: active ? "#C4664A" : "#fff", color: active ? "#fff" : "#717171" }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Why useful */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>
                  Why is this useful? <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
                </label>
                <textarea
                  value={submitNote}
                  onChange={(e) => setSubmitNote(e.target.value)}
                  placeholder="What makes this worth reading for families?"
                  rows={3}
                  style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", backgroundColor: "#fff" }}
                />
              </div>

              {/* Publication date */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>
                  Originally published <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
                </label>
                <input
                  type="month"
                  value={submitPublicationDate}
                  onChange={(e) => setSubmitPublicationDate(e.target.value)}
                  style={{ width: "100%", border: "1.5px solid #E8E8E8", borderRadius: "12px", padding: "11px 14px", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit", boxSizing: "border-box", backgroundColor: "#fff" }}
                />
                <p style={{ fontSize: "11px", color: "#AAAAAA", marginTop: "5px" }}>When was this originally published? Shown as &quot;Published Jan 2026&quot;</p>
              </div>

              {submitError && (
                <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600 }}>{submitError}</p>
              )}

              {/* Submit button */}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "none", backgroundColor: canSubmit ? "#C4664A" : "#E0E0E0", color: canSubmit ? "#fff" : "#aaa", fontSize: "15px", fontWeight: 700, cursor: canSubmit ? "pointer" : "default", fontFamily: "inherit" }}
              >
                {submitLoading ? "Submitting..." : "Submit for review"}
              </button>

            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTERS: FilterType[] = ["All", "Articles", "Videos", "Guides"];

export default function TravelIntelPage() {
  const [searchCity, setSearchCity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<{cityName: string; countryName: string; placeId?: string}[]>([]);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSugg, setShowSugg] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [activeTopic, setActiveTopic] = useState<TopicTag | null>(null);
  const [items, setItems] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch content
  useEffect(() => {
    setLoading(true);
    const params = searchCity ? `?city=${encodeURIComponent(searchCity)}` : "";
    fetch(`/api/travel-intel/guides${params}`)
      .then((r) => r.json())
      .then((data: GuideItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [searchCity]);

  // City autocomplete
  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (searchInput.length < 2) { setSuggestions([]); return; }
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/lookup?q=${encodeURIComponent(searchInput)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => { if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current); };
  }, [searchInput]);

  // Click outside closes suggestions
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSugg(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function applyCity(cityName: string, countryName?: string) {
    const value = countryName ? `${cityName}, ${countryName}` : cityName;
    setSearchInput(value);
    setSearchCity(value);
    setShowSugg(false);
    setSuggestions([]);
    setCurrentPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchCity("");
    setSuggestions([]);
    setCurrentPage(1);
    setShowSugg(false);
  }

  // Split community vs flokk
  const communityItems = items.filter((i) => !i.isFlokk);
  const flokkItems = items.filter((i) => i.isFlokk);

  // Apply type + topic filters (AND logic)
  const applyFilters = (list: GuideItem[]) =>
    list.filter((i) => matchesFilter(i, activeFilter) && (!activeTopic || i.tags.some(t => t.toLowerCase().includes(activeTopic.toLowerCase()))));
  const filteredCommunity = applyFilters(communityItems);
  const filteredFlokk = applyFilters(flokkItems);

  const totalPages = Math.ceil(filteredCommunity.length / ITEMS_PER_PAGE);
  const paginatedCommunity = filteredCommunity.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const isEmpty = !loading && filteredCommunity.length === 0 && filteredFlokk.length === 0;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "96px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
          <div>
            <h1 className={playfair.className} style={{ fontSize: "32px", fontWeight: 900, color: "#1B3A5C", lineHeight: 1.2, marginBottom: "8px" }}>
              Travel Intel
            </h1>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, maxWidth: "480px" }}>
              Guides, videos and stories from families who actually went.
            </p>
          </div>
          <button
            onClick={() => setShowSubmit(true)}
            style={{ flexShrink: 0, marginTop: "4px", padding: "9px 18px", borderRadius: "999px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            Submit →
          </button>
        </div>

        {/* ── Search bar ── */}
        <div ref={searchRef} style={{ position: "relative", marginBottom: "20px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={17} style={{ position: "absolute", left: "16px", color: "#AAAAAA", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search a destination..."
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setShowSugg(true); if (!e.target.value) setSearchCity(""); }}
              onFocus={() => setShowSugg(true)}
              onKeyDown={(e) => { if (e.key === "Enter") applyCity(searchInput); if (e.key === "Escape") clearSearch(); }}
              style={{ width: "100%", padding: "14px 44px", borderRadius: "999px", border: "1.5px solid #E5E5E5", fontSize: "15px", color: "#1a1a1a", backgroundColor: "#FAFAFA", outline: "none", boxSizing: "border-box", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            />
            {searchInput && (
              <button onClick={clearSearch} style={{ position: "absolute", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#AAAAAA", display: "flex", alignItems: "center" }}>
                <X size={15} />
              </button>
            )}
          </div>
          {showSugg && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "#fff", border: "1.5px solid #E5E5E5", borderRadius: "14px", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" }}>
              {suggestions.map((s) => (
                <button
                  key={s.placeId ?? `${s.cityName}-${s.countryName}`}
                  onMouseDown={() => applyCity(s.cityName, s.countryName)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                >
                  <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a1a" }}>{s.cityName}</span>
                    {s.countryName && s.countryName !== s.cityName && (
                      <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>· {s.countryName}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Filter pills — content type ── */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setCurrentPage(1); }}
                style={{ padding: "7px 18px", borderRadius: "999px", border: `1.5px solid ${active ? "#C4664A" : "#E0E0E0"}`, backgroundColor: active ? "#C4664A" : "#fff", color: active ? "#fff" : "#717171", fontSize: "13px", fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* ── Filter pills — topics ── */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "28px", flexWrap: "wrap", rowGap: 8 }}>
          <button
            onClick={() => { setActiveTopic(null); setCurrentPage(1); }}
            style={{ padding: "4px 10px", borderRadius: "999px", border: `1.5px solid ${activeTopic === null ? "#1B3A5C" : "#E0E0E0"}`, backgroundColor: activeTopic === null ? "#1B3A5C" : "#fff", color: activeTopic === null ? "#fff" : "#717171", fontSize: "12px", fontWeight: activeTopic === null ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
          >
            All Topics
          </button>
          {[...TOPIC_TAGS].sort((a, b) => a.localeCompare(b)).map((tag) => {
            const active = activeTopic === tag;
            return (
              <button
                key={tag}
                onClick={() => { setActiveTopic(active ? null : tag); setCurrentPage(1); }}
                style={{ padding: "4px 10px", borderRadius: "999px", border: `1.5px solid ${active ? "#1B3A5C" : "#E0E0E0"}`, backgroundColor: active ? "#1B3A5C" : "#fff", color: active ? "#fff" : "#717171", fontSize: "12px", fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <p style={{ fontSize: "13px", color: "#AAAAAA", textAlign: "center", padding: "64px 0" }}>Loading…</p>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#F9F9F9", borderRadius: "20px", border: "1px solid #EEEEEE" }}>
            <p style={{ fontSize: "32px", marginBottom: "16px" }}>📚</p>
            <p style={{ fontSize: "17px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>
              {searchCity ? `No guides for ${searchCity} yet.` : "No guides yet."}
            </p>
            <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.5, marginBottom: "24px" }}>
              {searchCity
                ? `Be the first to help families plan their ${searchCity} trip.`
                : "Be the first to submit a guide for families."}
            </p>
            <button
              onClick={() => setShowSubmit(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "11px 24px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "14px", fontWeight: 700, borderRadius: "999px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Submit a guide →
            </button>
          </div>
        )}

        {/* ── Community content grid ── */}
        {!loading && filteredCommunity.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
              {paginatedCommunity.map((item) => (
                <GuideCard key={item.id} item={item} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-[#1B3A5C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-[#1B3A5C] text-white"
                        : "text-stone-500 hover:text-[#1B3A5C] hover:bg-stone-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-[#1B3A5C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ── From Flokk section ── */}
        {!loading && filteredFlokk.length > 0 && (
          <div style={{ marginTop: "64px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>
              FROM FLOKK
            </p>
            <h2 className={playfair.className} style={{ fontSize: "22px", fontWeight: 900, color: "#1B3A5C", marginBottom: "24px", lineHeight: 1.2 }}>
              Our picks for family travel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: "24px" }}>
              {filteredFlokk.map((item) => (
                <GuideCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Submit modal ── */}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}
