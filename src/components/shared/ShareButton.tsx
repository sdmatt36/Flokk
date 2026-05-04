"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { ShareEntityType } from "@/lib/share-token";
import { getShareUrl, invokeNativeShare } from "@/lib/share";

// Evaluated inside event handlers (client-only context) to avoid SSR mismatch.
function isTouch(): boolean {
  return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
}

export function ShareButton({
  entityType,
  entityId,
  title = "Check this out on Flokk",
  label = "Share",
  style,
}: {
  entityType: ShareEntityType;
  entityId: string;
  title?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [toastAnchor, setToastAnchor] = useState<DOMRect | null>(null);
  // Tracks whether a prefetch has been initiated so re-hovers don't fire duplicate fetches.
  const prefetchStarted = useRef(false);

  useEffect(() => {
    if (!toastAnchor) return;
    const t = setTimeout(() => setToastAnchor(null), 3000);
    return () => clearTimeout(t);
  }, [toastAnchor]);

  // Desktop only: prefetch token on hover so click copies instantly (no fetch latency).
  // pointerenter fires on touch too, so the isTouch guard is explicit.
  async function handlePointerEnter() {
    if (isTouch() || prefetchStarted.current) return;
    prefetchStarted.current = true;
    const url = await getShareUrl(entityType, entityId);
    if (url) setCachedUrl(url);
  }

  async function copyAndToast(url: string, buttonEl: HTMLElement) {
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
    setToastAnchor(buttonEl.getBoundingClientRect());
  }

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (isLoading) return;

    if (isTouch()) {
      // ── Mobile / touch path ───────────────────────────────────────────────────
      // iOS Safari and Android Chrome forgive the async gap before navigator.share.
      setIsLoading(true);
      const url = cachedUrl ?? await getShareUrl(entityType, entityId);
      setIsLoading(false);
      if (!url) return;
      if (!cachedUrl) setCachedUrl(url);
      const result = await invokeNativeShare(url, title);
      if (result.fallback) await copyAndToast(url, e.currentTarget);
      return;
    }

    // ── Desktop path ──────────────────────────────────────────────────────────
    // Copy to clipboard and show anchored toast. navigator.share target selection
    // silently no-ops on macOS Chrome regardless of gesture timing.
    let url = cachedUrl;
    if (!url) {
      setIsLoading(true);
      url = await getShareUrl(entityType, entityId);
      setIsLoading(false);
      if (!url) return;
      setCachedUrl(url);
    }
    await copyAndToast(url, e.currentTarget);
  }

  const baseStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: isLoading ? "default" : "pointer",
    color: "#C4664A",
    padding: 0,
    fontSize: "12px",
    fontWeight: 600,
    fontFamily: "inherit",
    ...style,
  };

  return (
    <>
      <button onPointerEnter={handlePointerEnter} onClick={handleClick} style={baseStyle}>
        {isLoading ? "..." : label}
      </button>

      {toastAnchor && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: `${toastAnchor.top - 48}px`,
            left: `${toastAnchor.left + toastAnchor.width / 2}px`,
            transform: "translateX(-50%)",
            backgroundColor: "#fff",
            border: "1.5px solid #C4664A",
            color: "#1B3A5C",
            fontSize: "14px",
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: "8px",
            zIndex: 10001,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
          }}
        >
          <Check size={14} strokeWidth={2.5} color="#C4664A" />
          Link copied
        </div>,
        document.body,
      )}
    </>
  );
}
