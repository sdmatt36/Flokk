"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getVenueImage } from "@/lib/destination-images";

type SavedItemRow = {
  id: string;
  rawTitle: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  placePhotoUrl: string | null;
  mediaThumbnailUrl: string | null;
  createdAt: string;
};

type TripRow = {
  id: string;
  title: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  heroImageUrl: string | null;
  startDate: string | null;
  status: string;
};

type Filter = "all" | "missing" | "has";

const CARD_STYLE: React.CSSProperties = {
  border: "1px solid #E5E5E5",
  borderRadius: "12px",
  backgroundColor: "#fff",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const CARD_MISSING_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  border: "2px solid #E53935",
};

function PhotoPreview({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div style={{
        height: "140px", backgroundColor: "#FFF0EF",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#E53935", letterSpacing: "0.08em" }}>
          NO PHOTO
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      style={{ width: "100%", height: "140px", objectFit: "cover", flexShrink: 0, display: "block" }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function SavedItemCard({
  item,
  onSaved,
}: {
  item: SavedItemRow;
  onSaved: (id: string, url: string | null) => void;
}) {
  const displayUrl = item.placePhotoUrl ?? item.mediaThumbnailUrl;
  const [inputVal, setInputVal] = useState(item.placePhotoUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  const source = item.placePhotoUrl
    ? "placePhotoUrl"
    : item.mediaThumbnailUrl
    ? "mediaThumbnailUrl"
    : "none";

  async function save(url: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/photos/saved-item/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placePhotoUrl: url }),
      });
      if (!res.ok) throw new Error();
      onSaved(item.id, url);
      setFlash("ok");
    } catch {
      setFlash("err");
    } finally {
      setSaving(false);
      setTimeout(() => setFlash(null), 1500);
    }
  }

  function quickFill() {
    const title = item.rawTitle ?? "";
    const url = getVenueImage(title);
    if (url) setInputVal(url);
  }

  const hasMissingPhoto = !item.placePhotoUrl;

  return (
    <div style={hasMissingPhoto ? CARD_MISSING_STYLE : CARD_STYLE}>
      <PhotoPreview url={displayUrl} />

      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
            {item.rawTitle ?? "(no title)"}
          </p>
          <p style={{ fontSize: "11px", color: "#999", margin: "2px 0 0" }}>
            {[item.destinationCity, item.destinationCountry].filter(Boolean).join(", ") || "—"}
          </p>
          <p style={{ fontSize: "10px", color: source === "none" ? "#E53935" : "#4CAF50", margin: "2px 0 0", fontWeight: 600 }}>
            {source}
          </p>
        </div>

        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Paste photo URL..."
          style={{
            width: "100%", padding: "6px 8px", fontSize: "11px",
            border: "1px solid #E0E0E0", borderRadius: "6px",
            outline: "none", color: "#1a1a1a", backgroundColor: "#FAFAFA",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            onClick={() => save(inputVal || null)}
            disabled={saving}
            style={{
              flex: 1, padding: "5px 8px", fontSize: "11px", fontWeight: 700,
              backgroundColor: flash === "ok" ? "#4CAF50" : flash === "err" ? "#E53935" : "#1B3A5C",
              color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, transition: "background-color 0.2s",
            }}
          >
            {saving ? "…" : flash === "ok" ? "Saved" : flash === "err" ? "Error" : "Save"}
          </button>
          <button
            onClick={() => { setInputVal(""); save(null); }}
            disabled={saving}
            style={{
              padding: "5px 8px", fontSize: "11px", fontWeight: 700,
              backgroundColor: "#fff", color: "#E53935",
              border: "1px solid #E53935", borderRadius: "6px", cursor: "pointer",
            }}
          >
            Clear
          </button>
          <button
            onClick={quickFill}
            style={{
              padding: "5px 8px", fontSize: "11px", fontWeight: 600,
              backgroundColor: "#fff", color: "#C4664A",
              border: "1px solid #C4664A", borderRadius: "6px", cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Quick fill
          </button>
        </div>
      </div>
    </div>
  );
}

function TripCard({
  trip,
  onSaved,
}: {
  trip: TripRow;
  onSaved: (id: string, url: string | null) => void;
}) {
  const [inputVal, setInputVal] = useState(trip.heroImageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  async function save(url: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/photos/trip/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroImageUrl: url }),
      });
      if (!res.ok) throw new Error();
      onSaved(trip.id, url);
      setFlash("ok");
    } catch {
      setFlash("err");
    } finally {
      setSaving(false);
      setTimeout(() => setFlash(null), 1500);
    }
  }

  const hasMissingPhoto = !trip.heroImageUrl;

  return (
    <div style={hasMissingPhoto ? CARD_MISSING_STYLE : CARD_STYLE}>
      <PhotoPreview url={trip.heroImageUrl} />

      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.3 }}>
            {trip.title}
          </p>
          <p style={{ fontSize: "11px", color: "#999", margin: "2px 0 0" }}>
            {[trip.destinationCity, trip.destinationCountry].filter(Boolean).join(", ") || "—"}
          </p>
          <p style={{ fontSize: "10px", color: "#999", margin: "2px 0 0" }}>
            {trip.status}{trip.startDate ? ` · ${new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
          </p>
        </div>

        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Paste hero image URL..."
          style={{
            width: "100%", padding: "6px 8px", fontSize: "11px",
            border: "1px solid #E0E0E0", borderRadius: "6px",
            outline: "none", color: "#1a1a1a", backgroundColor: "#FAFAFA",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => save(inputVal || null)}
            disabled={saving}
            style={{
              flex: 1, padding: "5px 8px", fontSize: "11px", fontWeight: 700,
              backgroundColor: flash === "ok" ? "#4CAF50" : flash === "err" ? "#E53935" : "#1B3A5C",
              color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, transition: "background-color 0.2s",
            }}
          >
            {saving ? "…" : flash === "ok" ? "Saved" : flash === "err" ? "Error" : "Save"}
          </button>
          <button
            onClick={() => { setInputVal(""); save(null); }}
            disabled={saving}
            style={{
              padding: "5px 8px", fontSize: "11px", fontWeight: 700,
              backgroundColor: "#fff", color: "#E53935",
              border: "1px solid #E53935", borderRadius: "6px", cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPhotosClient() {
  const [tab, setTab] = useState<"items" | "trips">("items");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<SavedItemRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/photos/saved-items")
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setLoadingItems(false); })
      .catch(() => setLoadingItems(false));
  }, []);

  useEffect(() => {
    fetch("/api/admin/photos/trips")
      .then((r) => r.json())
      .then((d) => { setTrips(d.trips ?? []); setLoadingTrips(false); })
      .catch(() => setLoadingTrips(false));
  }, []);

  const handleItemSaved = useCallback((id: string, url: string | null) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, placePhotoUrl: url } : item));
  }, []);

  const handleTripSaved = useCallback((id: string, url: string | null) => {
    setTrips((prev) => prev.map((t) => t.id === id ? { ...t, heroImageUrl: url } : t));
  }, []);

  async function bulkFill() {
    setBulkRunning(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/photos/bulk-fill", { method: "POST" });
      const data = await res.json();
      setBulkResult(data.updated ?? 0);
      // Refresh items list to reflect updates
      const refreshed = await fetch("/api/admin/photos/saved-items").then((r) => r.json());
      setItems(refreshed.items ?? []);
    } catch {
      setBulkResult(-1);
    } finally {
      setBulkRunning(false);
    }
  }

  const filteredItems = items.filter((item) => {
    if (filter === "missing") return !item.placePhotoUrl;
    if (filter === "has") return !!item.placePhotoUrl;
    return true;
  });

  const missingCount = items.filter((i) => !i.placePhotoUrl).length;
  const missingTripCount = trips.filter((t) => !t.heroImageUrl).length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px", fontSize: "14px", fontWeight: 700,
    border: "none", cursor: "pointer", borderRadius: "8px",
    backgroundColor: active ? "#1B3A5C" : "transparent",
    color: active ? "#fff" : "#717171",
  });

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px", fontSize: "12px", fontWeight: 600,
    border: `1px solid ${active ? "#1B3A5C" : "#E0E0E0"}`,
    borderRadius: "999px", cursor: "pointer",
    backgroundColor: active ? "#1B3A5C" : "#fff",
    color: active ? "#fff" : "#555",
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F5F5" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1B3A5C", padding: "24px 32px" }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 4px",
        }}>
          Photo Management
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", margin: 0 }}>
          {items.length} saved items ({missingCount} missing photo) · {trips.length} trips ({missingTripCount} missing hero)
        </p>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #E5E5E5", padding: "12px 32px", display: "flex", gap: "8px" }}>
        <button onClick={() => setTab("items")} style={tabStyle(tab === "items")}>
          Saved Items {loadingItems ? "" : `(${items.length})`}
        </button>
        <button onClick={() => setTab("trips")} style={tabStyle(tab === "trips")}>
          Trips {loadingTrips ? "" : `(${trips.length})`}
        </button>
      </div>

      <div style={{ padding: "24px 32px" }}>

        {/* Saved Items tab */}
        {tab === "items" && (
          <>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["all", "missing", "has"] as Filter[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} style={filterBtnStyle(filter === f)}>
                    {f === "all" ? `All (${items.length})` : f === "missing" ? `Missing (${missingCount})` : `Has photo (${items.length - missingCount})`}
                  </button>
                ))}
              </div>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                {bulkResult !== null && (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: bulkResult >= 0 ? "#4CAF50" : "#E53935" }}>
                    {bulkResult >= 0 ? `✓ ${bulkResult} items updated` : "Error during bulk fill"}
                  </span>
                )}
                <button
                  onClick={bulkFill}
                  disabled={bulkRunning}
                  style={{
                    padding: "7px 16px", fontSize: "12px", fontWeight: 700,
                    backgroundColor: bulkRunning ? "#999" : "#C4664A",
                    color: "#fff", border: "none", borderRadius: "8px",
                    cursor: bulkRunning ? "not-allowed" : "pointer",
                  }}
                >
                  {bulkRunning ? "Running…" : "Fill all missing from venue map"}
                </button>
              </div>
            </div>

            {loadingItems ? (
              <p style={{ fontSize: "14px", color: "#999" }}>Loading…</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ fontSize: "14px", color: "#999" }}>No items match this filter.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <SavedItemCard key={item.id} item={item} onSaved={handleItemSaved} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Trips tab */}
        {tab === "trips" && (
          <>
            {loadingTrips ? (
              <p style={{ fontSize: "14px", color: "#999" }}>Loading…</p>
            ) : trips.length === 0 ? (
              <p style={{ fontSize: "14px", color: "#999" }}>No trips found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {trips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onSaved={handleTripSaved} />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
