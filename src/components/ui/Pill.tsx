"use client";

import { ReactNode } from "react";

export type PillVariant = "filter" | "platform" | "status" | "category";

interface PillProps {
  variant: PillVariant;
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "24px",
  padding: "0 10px",
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: "16px",
  borderRadius: "9999px",
  whiteSpace: "nowrap",
  flexShrink: 0,
  transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
};

function variantStyle(variant: PillVariant, active: boolean): React.CSSProperties {
  switch (variant) {
    case "filter":
      return active
        ? { background: "#C4664A", color: "#fff", border: "1px solid #C4664A" }
        : { background: "#fff", color: "#717171", border: "1px solid rgba(0,0,0,0.1)" };
    case "platform":
      return { background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid transparent" };
    case "status":
      return { background: "#C4664A", color: "#fff", border: "1px solid #C4664A" };
    case "category":
      return { background: "rgba(0,0,0,0.05)", color: "#666", border: "1px solid transparent" };
  }
}

export function Pill({ variant, active = false, onClick, children }: PillProps) {
  const style: React.CSSProperties = {
    ...BASE,
    ...variantStyle(variant, active),
    cursor: onClick ? "pointer" : "default",
    fontFamily: "inherit",
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={style}>
        {children}
      </button>
    );
  }
  return <span style={style}>{children}</span>;
}
