"use client";

import type { EntityStatus } from "@/lib/entity-status";

interface EntityStatusPillProps {
  status: EntityStatus;
  label: string;
  color: string;
  className?: string;
}

// Text colors: use the color directly for most; darken yellow for readability
const TEXT_COLOR_OVERRIDES: Partial<Record<EntityStatus, string>> = {
  rated: "#B45309",   // amber-700, #FBBF24 is too light on white
  completed: "#6B7280", // gray-500, #9CA3AF is too light on white
};

export function EntityStatusPill({ status, label, color, className }: EntityStatusPillProps) {
  if (status === "saved" || !label || !color) return null;

  const textColor = TEXT_COLOR_OVERRIDES[status] ?? color;
  // Parse hex to rgba for background
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: `rgba(${r},${g},${b},0.1)`,
        border: `1px solid rgba(${r},${g},${b},0.2)`,
        borderRadius: "999px",
        padding: "2px 8px",
      }}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: textColor,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
