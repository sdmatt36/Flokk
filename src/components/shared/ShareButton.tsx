"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { ShareEntityType } from "@/lib/share-token";
import { getShareUrl, invokeNativeShare } from "@/lib/share";
import { SharePopover } from "./SharePopover";

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
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Auto-dismiss copy toast after 3 seconds
  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(false), 3000);
    return () => clearTimeout(t);
  }, [copyToast]);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (isLoading) return;

    setIsLoading(true);
    const url = await getShareUrl(entityType, entityId);
    setIsLoading(false);

    if (!url) return;

    const result = await invokeNativeShare(url, title);
    if (result.fallback) {
      setShareUrl(url);
      setPopoverAnchor(e.currentTarget);
    }
    // shared or cancelled: nothing to do
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
      <button ref={btnRef} onClick={handleClick} style={baseStyle}>
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
