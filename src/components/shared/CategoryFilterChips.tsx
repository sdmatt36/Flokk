"use client";

export interface FilterChip {
  slug: string;
  label: string;
  count: number;
}

interface CategoryFilterChipsProps {
  selected: string | null;
  available: FilterChip[];
  onSelect: (slug: string | null) => void;
}

const BASE: React.CSSProperties = {
  flexShrink: 0,
  padding: "7px 16px",
  borderRadius: "999px",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

const ACTIVE: React.CSSProperties = {
  fontWeight: 600,
  color: "#fff",
  backgroundColor: "#C4664A",
  border: "none",
};

const INACTIVE: React.CSSProperties = {
  fontWeight: 400,
  color: "#717171",
  backgroundColor: "#fff",
  border: "1px solid rgba(0,0,0,0.1)",
};

export function CategoryFilterChips({ selected, available, onSelect }: CategoryFilterChipsProps) {
  return (
    <div
      style={{
        display: "flex",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        gap: "8px",
        paddingBottom: "4px",
        scrollbarWidth: "none",
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        style={{ ...BASE, ...(selected === null ? ACTIVE : INACTIVE) }}
      >
        All
      </button>
      {available.map((chip) => {
        const isActive = selected === chip.slug;
        return (
          <button
            key={chip.slug}
            type="button"
            onClick={() => onSelect(isActive ? null : chip.slug)}
            style={{ ...BASE, ...(isActive ? ACTIVE : INACTIVE) }}
          >
            {chip.label} ({chip.count})
          </button>
        );
      })}
    </div>
  );
}
