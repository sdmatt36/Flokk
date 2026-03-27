"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Share2, X } from "lucide-react";

type Family = {
  id: string;
  familyName: string | null;
  homeCity: string | null;
};

export function ShareTripButton({
  shareToken,
  tripId,
  tripTitle,
}: {
  shareToken: string;
  tripId: string;
  tripTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Family[]>([]);
  const [selected, setSelected] = useState<Family | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
  const noResults = query.length >= 2 && results.length === 0 && !isEmail && !selected;

  // Debounced search
  useEffect(() => {
    if (query.length < 2 || selected) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/families/search?q=${encodeURIComponent(query)}`);
        const data = await res.json() as { families: Family[] };
        setResults(data.families);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  function openModal() {
    setIsOpen(true);
    setQuery("");
    setResults([]);
    setSelected(null);
    setSending(false);
    setSent(false);
  }

  function closeModal() {
    setIsOpen(false);
  }

  async function handleSend() {
    setSending(true);
    try {
      await fetch(`/api/trips/${tripId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selected ? { recipientFamilyId: selected.id } : { recipientEmail: query }
        ),
      });
      setSent(true);
    } catch {
      // silent — sent stays false
    } finally {
      setSending(false);
    }
  }

  async function handleCopyLink() {
    const url = `https://www.flokktravel.com/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 2000);
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 12px",
          backgroundColor: "transparent",
          color: "#C4664A",
          border: "1.5px solid #C4664A",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
        }}
      >
        <Share2 size={12} />
        Share trip
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={closeModal}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.45)",
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "440px",
                padding: "24px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0A1628", fontFamily: '"Playfair Display", Georgia, serif' }}>
                  Share {tripTitle}
                </h2>
                <button
                  onClick={closeModal}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px", display: "flex", alignItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input */}
              <div style={{ marginBottom: "8px" }}>
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                    setSent(false);
                  }}
                  placeholder="Search by family name or enter email..."
                  style={{
                    width: "100%",
                    border: "1.5px solid #E5E7EB",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    fontSize: "14px",
                    color: "#0A1628",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#C4664A")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
                />
              </div>

              {/* Flokk user results */}
              {results.length > 0 && !selected && (
                <div
                  style={{
                    border: "1px solid #F3F4F6",
                    borderRadius: "10px",
                    marginBottom: "12px",
                    overflow: "hidden",
                  }}
                >
                  {results.map((family, i) => (
                    <button
                      key={family.id}
                      onClick={() => {
                        setSelected(family);
                        setQuery(
                          `${family.familyName ?? ""} Family` +
                            (family.homeCity ? `, ${family.homeCity}` : "")
                        );
                        setResults([]);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 14px",
                        background: "none",
                        border: "none",
                        borderBottom: i < results.length - 1 ? "1px solid #F3F4F6" : "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "#1B3A5C",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {(family.familyName ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#0A1628" }}>
                          {family.familyName} Family
                        </p>
                        {family.homeCity && (
                          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>{family.homeCity}</p>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#C4664A", whiteSpace: "nowrap" }}>
                        Flokk member
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results — prompt email */}
              {noResults && (
                <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "12px", paddingLeft: "2px" }}>
                  No Flokk families found. Enter their email to invite them.
                </p>
              )}

              {/* Send button */}
              {(selected || isEmail) && !sent && (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    width: "100%",
                    backgroundColor: sending ? "#e08060" : "#C4664A",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "14px",
                    padding: "13px",
                    borderRadius: "10px",
                    border: "none",
                    cursor: sending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    marginBottom: "4px",
                    transition: "background-color 0.15s",
                  }}
                >
                  {sending
                    ? "Sending..."
                    : selected
                    ? `Send to ${selected.familyName ?? ""} Family`
                    : `Send invite to ${query}`}
                </button>
              )}

              {/* Sent confirmation */}
              {sent && (
                <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#16A34A" }}>Sent ✓</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                    {selected
                      ? `${selected.familyName ?? ""} Family will receive a notification`
                      : `${query} will receive an email with your trip`}
                  </p>
                </div>
              )}

              {/* Divider + copy link */}
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #F3F4F6",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#9CA3AF" }}>Or share the link directly</span>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: copyConfirmed ? "#16A34A" : "#C4664A",
                      fontFamily: "inherit",
                      padding: 0,
                    }}
                  >
                    {copyConfirmed ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "#D1D5DB",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  flokktravel.com/share/{shareToken}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
