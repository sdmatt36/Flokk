"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon } from "lucide-react";

export function SaveLinkInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicateCity, setDuplicateCity] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    setDuplicateId(null);
    setDuplicateCity(null);

    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      if (data.duplicate) {
        setDuplicateId(data.existingId ?? null);
        setDuplicateCity(data.existingCity ?? null);
        return;
      }

      setUrl("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon
            size={15}
            style={{ color: "#717171", position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setDuplicateId(null); setDuplicateCity(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Paste a link from Instagram, TikTok, Maps..."
            disabled={saving}
            style={{
              width: "100%",
              height: "48px",
              paddingLeft: "38px",
              paddingRight: "14px",
              borderRadius: "14px",
              border: "1.5px solid #EEEEEE",
              backgroundColor: "#fff",
              fontSize: "14px",
              color: "#1a1a1a",
              outline: "none",
            }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !url.trim()}
          style={{
            height: "48px",
            paddingLeft: "20px",
            paddingRight: "20px",
            borderRadius: "14px",
            backgroundColor: saving || !url.trim() ? "#EEEEEE" : "#C4664A",
            color: saving || !url.trim() ? "#717171" : "#fff",
            fontWeight: 600,
            fontSize: "14px",
            flexShrink: 0,
            cursor: saving || !url.trim() ? "not-allowed" : "pointer",
            border: "none",
            transition: "background-color 0.15s",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {error && <p style={{ fontSize: "13px", color: "#C4664A" }}>{error}</p>}
      {success && (
        <p style={{ fontSize: "13px", color: "#6B8F71", fontWeight: 500 }}>Saved successfully.</p>
      )}
      {duplicateId && (
        <p style={{ fontSize: "13px", color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", padding: "10px 14px" }}>
          You already saved{duplicateCity ? ` this in ${duplicateCity}` : " this"}.{" "}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(`save-${duplicateId}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                (el as HTMLElement).style.outline = "2px solid #C4664A";
                setTimeout(() => { (el as HTMLElement).style.outline = ""; }, 2000);
              }
              setDuplicateId(null);
            }}
            style={{ fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "#92400e", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}
          >
            View it
          </button>
        </p>
      )}

      <p style={{ fontSize: "12px", color: "#717171" }}>
        Works with Instagram, TikTok, Google Maps, Airbnb, Booking.com, and most links.
      </p>
    </div>
  );
}
