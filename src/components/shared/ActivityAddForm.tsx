"use client";

import { useState, useEffect } from "react";
import { CategoryEditor } from "@/components/shared/CategoryEditor";

interface ActivityAddFormTarget {
  tripId?: string;
  cityId?: string;
}

interface ActivityAddFormPrefill {
  name?: string;
  city?: string;
  categories?: string[];
}

export interface ActivityAddFormProps {
  target?: ActivityAddFormTarget;
  prefill?: ActivityAddFormPrefill;
  onSuccess: (saved: { id: string }) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  fontSize: "14px",
  color: "#1a1a1a",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
  marginBottom: "14px",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#1B3A5C",
  marginBottom: "6px",
};

export function ActivityAddForm({
  target,
  prefill,
  onSuccess,
}: ActivityAddFormProps) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [city, setCity] = useState(prefill?.city ?? "");
  const [categories, setCategories] = useState<string[]>(
    prefill?.categories ?? []
  );
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (prefill?.name !== undefined) setName(prefill.name);
    if (prefill?.city !== undefined) setCity(prefill.city);
    if (prefill?.categories !== undefined) setCategories(prefill.categories);
  }, [prefill?.name, prefill?.city, prefill?.categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMethod: "URL_PASTE",
          title: name.trim(),
          city: city.trim() || null,
          category: categories[0] ?? null,
          categoryTags: categories,
          websiteUrl: website.trim() || null,
          notes: notes.trim() || null,
          tripId: target?.tripId ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { id?: string; savedItem?: { id: string } };
      const id = data.id ?? data.savedItem?.id ?? "";
      onSuccess({ id });
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={LABEL_STYLE}>
        Place name <span style={{ color: "#C4664A" }}>*</span>
      </label>
      <input
        autoFocus
        type="text"
        placeholder="e.g. Nishiki Market, Blue Lagoon, Le Comptoir..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        style={INPUT_STYLE}
      />

      <label style={LABEL_STYLE}>City</label>
      <input
        type="text"
        placeholder="e.g. Kyoto, Reykjavik..."
        value={city}
        onChange={(e) => setCity(e.target.value)}
        style={INPUT_STYLE}
      />

      <label style={LABEL_STYLE}>Categories</label>
      <div style={{ marginBottom: "14px" }}>
        <CategoryEditor
          value={categories}
          onChange={setCategories}
          onSave={async () => {}}
          disabled={submitting}
        />
      </div>

      <label style={LABEL_STYLE}>Website</label>
      <input
        type="url"
        placeholder="https://..."
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={INPUT_STYLE}
      />

      <label style={LABEL_STYLE}>Notes</label>
      <textarea
        placeholder="Anything to remember..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        style={{
          ...INPUT_STYLE,
          resize: "none",
          marginBottom: "20px",
          lineHeight: "1.5",
        }}
      />

      {error && (
        <p style={{ fontSize: "13px", color: "#e53e3e", marginBottom: "12px" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: "999px",
          backgroundColor:
            submitting || !name.trim() ? "#E5E5E5" : "#C4664A",
          color: submitting || !name.trim() ? "#AAAAAA" : "#fff",
          fontSize: "14px",
          fontWeight: 700,
          border: "none",
          cursor: submitting || !name.trim() ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {submitting ? "Saving..." : "Save place"}
      </button>
    </form>
  );
}
