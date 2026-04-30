"use client";

import React from "react";

const FALLBACK_COLORS = ["#1B3A5C", "#C4664A"] as const;

const PREFIX_STRIPS = [
  /^Check-in:\s*/i,
  /^Check-out:\s*/i,
  /^Departure:\s*/i,
  /^Arrival:\s*/i,
];

function stripDisplayPrefix(title: string): string {
  let result = title.trim();
  for (const re of PREFIX_STRIPS) {
    result = result.replace(re, "");
  }
  return result.trim();
}

function getFirstLetter(title: string): string {
  const stripped = stripDisplayPrefix(title);
  for (const ch of stripped) {
    if (/[A-Za-z0-9]/.test(ch)) return ch.toUpperCase();
  }
  return "?";
}

function getColorForTitle(title: string): string {
  const hash = title.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

type ItemImageTileVariant = "card" | "modal" | "share";

interface ItemImageTileProps {
  src: string | null | undefined;
  title: string;
  variant?: ItemImageTileVariant;
  className?: string;
}

const VARIANT_DIMENSIONS: Record<ItemImageTileVariant, React.CSSProperties> = {
  card: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flexShrink: 0,
  },
  modal: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  share: {
    width: "100%",
    height: 240,
    borderRadius: 12,
  },
};

const VARIANT_FONT_SIZE: Record<ItemImageTileVariant, string> = {
  card: "32px",
  modal: "64px",
  share: "72px",
};

export function ItemImageTile({
  src,
  title,
  variant = "card",
  className,
}: ItemImageTileProps) {
  const dims = VARIANT_DIMENSIONS[variant];

  if (src) {
    return (
      <img
        src={src}
        alt={stripDisplayPrefix(title)}
        className={className}
        style={{
          ...dims,
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }

  const bgColor = getColorForTitle(title);
  const letter = getFirstLetter(title);

  return (
    <div
      className={className}
      style={{
        ...dims,
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFFFFF",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: VARIANT_FONT_SIZE[variant],
        fontWeight: 700,
        lineHeight: 1,
        userSelect: "none",
      }}
      aria-label={stripDisplayPrefix(title)}
      role="img"
    >
      {letter}
    </div>
  );
}

export default ItemImageTile;
