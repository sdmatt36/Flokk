"use client";

import { useEffect, useState, useCallback } from "react";

type Spot = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  averageRating: number | null;
  ratingCount: number;
  updatedAt: string;
  needsUrlReview: boolean;
};

type EditFields = {
  name: string;
  city: string;
  category: string;
  description: string;
  photoUrl: string;
  websiteUrl: string;
};

type FetchState = "idle" | "loading" | "done" | "error";

export function AdminSpotsClient() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterNeedsUrl, setFilterNeedsUrl] = useState(false);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({ name: "", city: "", category: "", description: "", photoUrl: "", websiteUrl: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fetchStates, setFetchStates] = useState<Record<string, FetchState>>({});

  const loadSpots = useCallback(async (needsUrl: boolean) => {
    setIsLoading(true);
    try {
      const url = needsUrl ? "/api/community-spots?needsUrlReview=true" : "/api/community-spots";
      const res = await fetch(url);
      const data = await res.json();
      setSpots(data.spots ?? []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpots(filterNeedsUrl);
  }, [filterNeedsUrl, loadSpots]);

  const filtered = spots.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q) ||
      (s.country ?? "").toLowerCase().includes(q)
    );
  });

  function startEdit(spot: Spot) {
    setEditingId(spot.id);
    setEditFields({
      name: spot.name ?? "",
      city: spot.city ?? "",
      category: spot.category ?? "",
      description: "",
      photoUrl: spot.photoUrl ?? "",
      websiteUrl: spot.websiteUrl ?? "",
    });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/community-spots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFields.name || null,
          city: editFields.city || null,
          category: editFields.category || null,
          description: editFields.description || null,
          photoUrl: editFields.photoUrl || null,
          websiteUrl: editFields.websiteUrl || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Save failed");
        return;
      }
      const d = await res.json();
      setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, ...d.spot } : s)));
      setEditingId(null);
    } catch {
      setSaveError("Network error");
    } finally {
      setIsSaving(false);
    }
  }

  async function fetchGooglePhoto(spot: Spot) {
    setFetchStates((prev) => ({ ...prev, [spot.id]: "loading" }));
    try {
      const res = await fetch(`/api/community-spots/${spot.id}/fetch-photo`, { method: "POST" });
      if (!res.ok) {
        setFetchStates((prev) => ({ ...prev, [spot.id]: "error" }));
        return;
      }
      const d = await res.json();
      setSpots((prev) => prev.map((s) => (s.id === spot.id ? { ...s, ...d.spot } : s)));
      setFetchStates((prev) => ({ ...prev, [spot.id]: "done" }));
    } catch {
      setFetchStates((prev) => ({ ...prev, [spot.id]: "error" }));
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F9F9F9", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #E5E5E5", padding: "20px 32px", display: "flex", alignItems: "center", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1B3A5C", margin: 0, fontFamily: "Playfair Display, serif" }}>Community Spots</h1>
          <p style={{ fontSize: "13px", color: "#717171", margin: "2px 0 0" }}>{filtered.length} spots</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <a href="/admin/content" style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, textDecoration: "none" }}>Content</a>
          <a href="/admin/photos" style={{ fontSize: "13px", color: "#C4664A", fontWeight: 500, textDecoration: "none" }}>Photos</a>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search spots, city, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: "360px", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", fontFamily: "inherit" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#717171", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={filterNeedsUrl}
            onChange={(e) => setFilterNeedsUrl(e.target.checked)}
            style={{ accentColor: "#C4664A" }}
          />
          Needs URL review only
        </label>
        <button
          onClick={() => loadSpots(filterNeedsUrl)}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", cursor: "pointer", color: "#717171", fontFamily: "inherit" }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ padding: "0 32px 40px" }}>
        {isLoading ? (
          <p style={{ fontSize: "14px", color: "#717171", padding: "32px 0" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#717171", padding: "32px 0" }}>No spots found.</p>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", overflow: "hidden" }}>
            {filtered.map((spot, i) => {
              const isEditing = editingId === spot.id;
              const fetchState = fetchStates[spot.id] ?? "idle";
              return (
                <div
                  key={spot.id}
                  style={{
                    borderTop: i > 0 ? "1px solid #F0F0F0" : undefined,
                    padding: "16px 20px",
                    backgroundColor: isEditing ? "#FFFBF9" : undefined,
                  }}
                >
                  {isEditing ? (
                    /* Edit form */
                    <div>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                        {(["name", "city", "category", "photoUrl", "websiteUrl"] as const).map((field) => (
                          <div key={field} style={{ flex: "1 1 200px" }}>
                            <label style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                              {field}
                            </label>
                            <input
                              type="text"
                              value={editFields[field]}
                              onChange={(e) => setEditFields((prev) => ({ ...prev, [field]: e.target.value }))}
                              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1.5px solid #E5E5E5", fontSize: "13px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                            />
                          </div>
                        ))}
                      </div>
                      {saveError && (
                        <p style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, margin: "0 0 8px" }}>{saveError}</p>
                      )}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => saveEdit(spot.id)}
                          disabled={isSaving}
                          style={{ padding: "7px 16px", borderRadius: "6px", border: "none", backgroundColor: isSaving ? "#E5E5E5" : "#C4664A", color: isSaving ? "#aaa" : "#fff", fontSize: "13px", fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSaving}
                          style={{ padding: "7px 16px", borderRadius: "6px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", fontSize: "13px", cursor: "pointer", color: "#717171", fontFamily: "inherit" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Row view */
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {/* Thumbnail */}
                      <div style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, backgroundColor: "#F0F0F0" }}>
                        {spot.photoUrl ? (
                          <img src={spot.photoUrl} alt={spot.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "10px", color: "#aaa" }}>no photo</span>
                          </div>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1B3A5C" }}>{spot.name}</span>
                          {spot.needsUrlReview && (
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#D97706", backgroundColor: "#FFFBEB", padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.04em" }}>NEEDS URL</span>
                          )}
                          {!spot.photoUrl && (
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#717171", backgroundColor: "#F0F0F0", padding: "2px 6px", borderRadius: "4px", letterSpacing: "0.04em" }}>NO PHOTO</span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "#717171", marginTop: "2px" }}>
                          {[spot.city, spot.country, spot.category].filter(Boolean).join(" · ")}
                          {spot.ratingCount > 0 && (
                            <span style={{ marginLeft: "8px" }}>{spot.averageRating?.toFixed(1)} ({spot.ratingCount})</span>
                          )}
                        </div>
                        {spot.websiteUrl && (
                          <a href={spot.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#C4664A", textDecoration: "none" }}>
                            {spot.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 50)}
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        <button
                          onClick={() => fetchGooglePhoto(spot)}
                          disabled={fetchState === "loading"}
                          title="Fetch photo + URL from Google Places"
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1.5px solid #E5E5E5",
                            backgroundColor: fetchState === "done" ? "#F0FDF4" : fetchState === "error" ? "#FEF2F2" : "#fff",
                            fontSize: "12px",
                            cursor: fetchState === "loading" ? "not-allowed" : "pointer",
                            color: fetchState === "done" ? "#16a34a" : fetchState === "error" ? "#C4664A" : "#717171",
                            fontFamily: "inherit",
                            fontWeight: 500,
                          }}
                        >
                          {fetchState === "loading" ? "Fetching…" : fetchState === "done" ? "Fetched" : fetchState === "error" ? "Failed" : "Google Photo"}
                        </button>
                        <button
                          onClick={() => startEdit(spot)}
                          style={{ padding: "6px 12px", borderRadius: "6px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", fontSize: "12px", cursor: "pointer", color: "#1B3A5C", fontFamily: "inherit", fontWeight: 500 }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
