"use client";

import { useRef, useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/categories";

interface CategoryEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  onSave: (final: string[]) => Promise<void>;
  disabled?: boolean;
}

export function CategoryEditor({ value, onChange, onSave, disabled = false }: CategoryEditorProps) {
  const latestRef = useRef<string[]>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);

  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleToggle(slug: string) {
    if (disabled) return;
    const next = value.includes(slug)
      ? value.filter((t) => t !== slug)
      : [...value, slug];
    onChange(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await onSave(latestRef.current);
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2000);
      } catch {
        // silent
      }
    }, 600);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {CATEGORIES.map(({ slug, label }) => {
          const active = value.includes(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => handleToggle(slug)}
              disabled={disabled}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: "999px",
                border: "1.5px solid",
                borderColor: active ? "#C4664A" : "#D0D0D0",
                backgroundColor: active ? "#C4664A" : "#fff",
                color: active ? "#fff" : "#666",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.12s ease",
                opacity: disabled ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {savedIndicator && (
        <p style={{ fontSize: "11px", color: "#4a7c59", fontWeight: 600, margin: "6px 0 0" }}>
          Saved ✓
        </p>
      )}
    </div>
  );
}
