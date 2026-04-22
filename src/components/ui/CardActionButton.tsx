"use client";

import { ReactNode } from "react";

export type ActionVariant = "primary" | "secondary" | "disabled";

interface CardActionButtonProps {
  variant: ActionVariant;
  icon?: ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  flex?: boolean;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "34px",
  padding: "0 12px",
  fontSize: "12px",
  fontWeight: 500,
  borderRadius: "8px",
  cursor: "pointer",
  transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

function variantStyle(variant: ActionVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "#C4664A", color: "#fff", border: "1px solid #C4664A" };
    case "secondary":
      return { background: "#fff", color: "#1B3A5C", border: "1px solid #e5e7eb" };
    case "disabled":
      return { background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e5e7eb", cursor: "default" };
  }
}

export function CardActionButton({ variant, icon, label, onClick, flex }: CardActionButtonProps) {
  return (
    <button
      type="button"
      onClick={variant === "disabled" ? undefined : onClick}
      disabled={variant === "disabled"}
      style={{ ...BASE, ...variantStyle(variant), flex: flex ? 1 : undefined }}
    >
      {icon}
      {label}
    </button>
  );
}
