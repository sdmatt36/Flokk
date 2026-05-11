"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

interface Peer {
  slug: string;
  name: string;
}

interface Props {
  variant: "dropdown" | "pills";
  peers: Peer[];
  currentSlug: string;
  routePrefix: string;
  label: string;
}

export function LateralPeerNav({ variant, peers, currentSlug, routePrefix, label }: Props) {
  const router = useRouter();
  const fmt = (slug: string) => `${routePrefix}/${slug}`;

  if (peers.length === 0) return null;

  if (variant === "dropdown") {
    return <PeerDropdown peers={peers} currentSlug={currentSlug} routeFormatter={fmt} label={label} router={router} />;
  }

  return <PeerPills peers={peers} currentSlug={currentSlug} routeFormatter={fmt} label={label} router={router} />;
}

// ── Dropdown variant ──────────────────────────────────────────────────────────

function PeerDropdown({ peers, currentSlug, routeFormatter, label, router }: {
  peers: Peer[];
  currentSlug: string;
  routeFormatter: (s: string) => string;
  label: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setFilter("");
  }, [open]);

  const filtered = filter.trim()
    ? peers.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : peers;

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 14px",
          height: "38px",
          border: "1px solid #E2E8F0",
          borderRadius: "999px",
          backgroundColor: open ? "#F8FAFC" : "#fff",
          fontSize: "13px",
          fontWeight: 500,
          color: "#1B3A5C",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <ChevronDown size={14} style={{ color: "#94A3B8", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "240px",
            backgroundColor: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Filter input */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              autoComplete="off"
              name="peer-filter-nondescript"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
              style={{
                width: "100%",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                color: "#1B3A5C",
                outline: "none",
                backgroundColor: "#F8FAFC",
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p style={{ padding: "16px", fontSize: "12px", color: "#94A3B8", textAlign: "center" }}>
                No matches
              </p>
            ) : (
              filtered.map((peer) => {
                const isCurrent = peer.slug === currentSlug;
                return (
                  <button
                    key={peer.slug}
                    onClick={() => { setOpen(false); router.push(routeFormatter(peer.slug)); }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 16px",
                      fontSize: "13px",
                      fontWeight: isCurrent ? 700 : 400,
                      color: isCurrent ? "#C4664A" : "#1B3A5C",
                      backgroundColor: isCurrent ? "#FFF3EE" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {peer.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pills variant ─────────────────────────────────────────────────────────────

function PeerPills({ peers, currentSlug, routeFormatter, label, router }: {
  peers: Peer[];
  currentSlug: string;
  routeFormatter: (s: string) => string;
  label: string;
  router: ReturnType<typeof useRouter>;
}) {
  const PILL_THRESHOLD = 6;
  const pillPeers = peers.slice(0, PILL_THRESHOLD);
  const overflowPeers = peers.slice(PILL_THRESHOLD);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
      <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 600, flexShrink: 0, paddingRight: "2px" }}>
        {label}:
      </span>
      {pillPeers.map((peer) => {
        const isCurrent = peer.slug === currentSlug;
        return (
          <button
            key={peer.slug}
            onClick={() => router.push(routeFormatter(peer.slug))}
            style={{
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: isCurrent ? 700 : 500,
              color: isCurrent ? "#C4664A" : "#555",
              backgroundColor: isCurrent ? "#FFF3EE" : "#F8FAFC",
              border: isCurrent ? "1px solid #C4664A" : "1px solid #E2E8F0",
              borderRadius: "999px",
              padding: "5px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {peer.name}
          </button>
        );
      })}
      {overflowPeers.length > 0 && (
        <PeerDropdown
          peers={overflowPeers}
          currentSlug={currentSlug}
          routeFormatter={routeFormatter}
          label={`+${overflowPeers.length} more`}
          router={router}
        />
      )}
    </div>
  );
}
