"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { ShareEntityType } from "@/lib/share-token";
import { getShareUrl, invokeNativeShare } from "@/lib/share";
import { SharePopover } from "./SharePopover";

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
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  // Tracks whether a prefetch has been initiated so re-hovers don't fire duplicate fetches.
  const prefetchStarted = useRef(false);

  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(false), 3000);
    return () => clearTimeout(t);
  }, [copyToast]);

  // Desktop only: prefetch token on hover so click opens the popover instantly
  // (no fetch latency). pointerenter fires on touch too, so the isTouch guard is explicit.
  async function handlePointerEnter() {
    if (isTouch() || prefetchStarted.current) return;
    prefetchStarted.current = true;
    const url = await getShareUrl(entityType, entityId);
    if (url) setCachedUrl(url);
  }

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (isLoading) return;

    if (!isTouch()) {
      // ── Desktop path ─────────────────────────────────────────────────────────
      // macOS Chrome silently no-ops navigator.share target selection regardless of
      // gesture timing. Desktop always uses the popover menu instead.
      let url = cachedUrl;
      if (!url) {
        setIsLoading(true);
        url = await getShareUrl(entityType, entityId);
        setIsLoading(false);
        if (!url) return;
        setCachedUrl(url);
      }
      setShareUrl(url);
      setPopoverAnchor(e.currentTarget);
      return;
    }

    // ── Mobile / touch path ───────────────────────────────────────────────────
    // iOS Safari and Android Chrome forgive the async gap before navigator.share.
    // Re-use cached URL if pointerenter somehow fired and completed (rare on mobile).
    setIsLoading(true);
    const url = cachedUrl ?? await getShareUrl(entityType, entityId);
    setIsLoading(false);
    if (!url) return;
    if (!cachedUrl) setCachedUrl(url);
    const result = await invokeNativeShare(url, title);
    if (result.fallback) {
      setShareUrl(url);
      setPopoverAnchor(e.currentTarget);
    }
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

      {popoverAnchor && shareUrl && (
        <SharePopover
          url={shareUrl}
          title={title}
          anchorEl={popoverAnchor}
          onClose={() => { setPopoverAnchor(null); setShareUrl(null); }}
          onCopySuccess={() => setCopyToast(true)}
        />
      )}

      {copyToast && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1B3A5C",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 600,
            padding: "12px 24px",
            borderRadius: "999px",
            zIndex: 10001,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "inherit",
          }}
        >
          <Check size={16} strokeWidth={2.5} />
          Link copied
        </div>,
        document.body,
      )}
    </>
  );
}
