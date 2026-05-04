"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function SharePopover({
  url,
  title,
  anchorEl,
  onClose,
  onCopySuccess,
}: {
  url: string;
  title: string;
  anchorEl: HTMLElement;
  onClose: () => void;
  onCopySuccess: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const rect = anchorEl.getBoundingClientRect();

  useEffect(() => {
    function handleOutsideDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        e.target !== anchorEl
      ) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener("mousedown", handleOutsideDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { once: true });
    return () => {
      document.removeEventListener("mousedown", handleOutsideDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [onClose, anchorEl]);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, url.length);
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    onCopySuccess();
    onClose();
  }

  const emailUrl = `mailto:?subject=${encodeURIComponent("Check this out on Flokk")}&body=${encodeURIComponent(`${title}\n${url}`)}`;
  const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  // Anchor below-left of the button. Flip left if popover would overflow right edge.
  const popoverWidth = 180;
  const viewportWidth = window.innerWidth;
  const leftAnchor = rect.left + popoverWidth > viewportWidth ? rect.right - popoverWidth : rect.left;

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#1B3A5C",
    fontFamily: "inherit",
    borderRadius: "8px",
  };

  function menuItem(label: string, onClick: (e: React.MouseEvent) => void) {
    return (
      <button
        style={itemStyle}
        onClick={onClick}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        {label}
      </button>
    );
  }

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${leftAnchor}px`,
        backgroundColor: "#fff",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "4px",
        minWidth: `${popoverWidth}px`,
        zIndex: 10000,
      }}
    >
      {menuItem("Copy link", handleCopy)}
      {menuItem("Email", e => { e.stopPropagation(); window.location.href = emailUrl; onClose(); })}
      {menuItem("X", e => { e.stopPropagation(); window.open(xUrl, "_blank", "noopener,noreferrer"); onClose(); })}
      {menuItem("WhatsApp", e => { e.stopPropagation(); window.open(whatsappUrl, "_blank", "noopener,noreferrer"); onClose(); })}
    </div>,
    document.body,
  );
}
