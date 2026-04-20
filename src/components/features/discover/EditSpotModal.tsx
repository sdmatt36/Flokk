"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Trash2 } from "lucide-react";

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";

const CATEGORIES = ["Food", "Culture", "Outdoor", "Shopping", "Lodging", "Activity", "Other"];

export interface EditableSpot {
  id: string;
  name: string;
  city: string;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  websiteUrl: string | null;
}

interface EditSpotModalProps {
  spot: EditableSpot;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (updated: EditableSpot) => void;
  onDeleted?: () => void;
}

export function EditSpotModal({ spot, canDelete, onClose, onSaved, onDeleted }: EditSpotModalProps) {
  const [name, setName] = useState(spot.name);
  const [city, setCity] = useState(spot.city);
  const [category, setCategory] = useState(spot.category ?? "Other");
  const [description, setDescription] = useState(spot.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(spot.photoUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(spot.websiteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim() || !city.trim()) {
      setError("Name and city are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/community-spots/${spot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          category,
          description: description.trim() || null,
          photoUrl: photoUrl.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSaved(data.spot);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${spot.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community-spots/${spot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  const content = (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.5)", padding: "16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "12px", maxWidth: "520px", width: "100%",
          maxHeight: "90vh", overflowY: "auto", padding: "28px", position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
          aria-label="Close"
        >
          <X size={20} color="#717171" />
        </button>

        <h2 style={{ fontSize: "20px", fontWeight: 600, color: NAVY, margin: "0 0 20px" }}>Edit spot</h2>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 12px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: NAVY, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>City</label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: NAVY, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {CATEGORIES.map(c => {
              const active = category === c;
              return (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  style={{
                    padding: "6px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    border: active ? "none" : "1px solid #E8E8E8",
                    background: active ? TERRA : "#fff",
                    color: active ? "#fff" : NAVY,
                    fontFamily: "inherit",
                  }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 280))} rows={3}
            placeholder="What makes this place special (280 chars max)"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: NAVY, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ fontSize: "11px", color: "#717171", textAlign: "right", marginTop: "2px" }}>{description.length}/280</div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Website URL</label>
          <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: NAVY, boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Photo URL</label>
          <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", color: NAVY, boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          {canDelete ? (
            <button type="button" onClick={handleDelete} disabled={deleting}
              style={{ background: "none", border: "none", color: "#B91C1C", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: "6px 0", fontFamily: "inherit" }}>
              <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete spot"}
            </button>
          ) : <span />}

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={onClose}
              style={{ padding: "10px 18px", background: "#fff", color: NAVY, border: "1px solid #E8E8E8", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ padding: "10px 18px", background: TERRA, color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
