"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X, Trash2, Check } from "lucide-react";

// Owner-side "Invite to collaborate" modal. Backend is POST/GET/DELETE
// /api/trips/[id]/collaborators (+ /[collaboratorId] for revoke). UI only.

const NAVY = "#1B3A5C";
const TERRA = "#C4664A";
const MUTED = "#6B7280";
const HAIR = "#EEEEEE";
const NAVY_TINT = "rgba(27,58,92,0.06)";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "OWNER" | "EDITOR" | "VIEWER";

type Collaborator = {
  id: string;
  role: Role;
  familyProfileId: string | null;
  familyName: string | null;
  invitedEmail: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  isPending: boolean;
  isYou: boolean;
};

function roleWord(role: Role): string {
  if (role === "OWNER") return "Owner";
  if (role === "EDITOR") return "Editor";
  return "Viewer";
}

export function InviteCollaboratorModal({
  visible,
  onClose,
  tripId,
  tripTitle,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : []);
      }
    } catch {
      // list is best-effort; the invite form still works
    }
  }, [tripId]);

  useEffect(() => {
    if (visible) {
      setError(null);
      setToast(null);
      void loadList();
    }
  }, [visible, loadList]);

  if (!visible || typeof window === "undefined") return null;

  async function handleSend() {
    const trimmed = email.trim();
    setError(null);
    setToast(null);
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 duplicate / 400 invalid / 404 / 500 all carry a server error string
        setError(typeof data?.error === "string" ? data.error : "Could not send invite. Please try again.");
        return;
      }
      setToast(`Invitation sent to ${trimmed}`);
      setEmail("");
      if (data?.collaborator) {
        setCollaborators((prev) => [...prev, data.collaborator as Collaborator]);
      } else {
        void loadList();
      }
    } catch {
      setError("Could not send invite. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCollaborators((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // leave the row; owner can retry
    }
  }

  const RoleOption = ({ value, label, desc }: { value: "EDITOR" | "VIEWER"; label: string; desc: string }) => {
    const on = role === value;
    return (
      <button
        type="button"
        onClick={() => setRole(value)}
        style={{
          flex: 1,
          textAlign: "left",
          padding: "10px 12px",
          borderRadius: "10px",
          border: `1.5px solid ${on ? NAVY : HAIR}`,
          backgroundColor: on ? NAVY_TINT : "#fff",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "block", fontSize: "13px", fontWeight: 700, color: NAVY }}>{label}</span>
        <span style={{ display: "block", fontSize: "11.5px", color: MUTED, marginTop: "2px" }}>{desc}</span>
      </button>
    );
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "440px",
          maxHeight: "88vh",
          overflowY: "auto",
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}>
          <h2 style={{ flex: 1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color: NAVY, margin: 0 }}>
            Invite to collaborate
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: "2px", lineHeight: 1 }}
          >
            <X size={20} />
          </button>
        </div>
        <p style={{ fontSize: "13px", color: MUTED, marginTop: 0, marginBottom: "18px", lineHeight: 1.5 }}>
          Invite family or friends to help plan {tripTitle}. They will get an email to join.
        </p>

        {/* Email input */}
        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Email
        </label>
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
          placeholder="name@example.com"
          style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1.5px solid ${HAIR}`, fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box" }}
        />

        {/* Role select */}
        <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#555", margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Role
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <RoleOption value="EDITOR" label="Editor" desc="Can add and edit plans" />
          <RoleOption value="VIEWER" label="Viewer" desc="Can view the trip" />
        </div>

        {/* Inline feedback */}
        {error && (
          <p style={{ fontSize: "13px", color: "#C0392B", marginTop: "12px", marginBottom: 0 }}>{error}</p>
        )}
        {toast && (
          <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#1E7A46", marginTop: "12px", marginBottom: 0 }}>
            <Check size={14} /> {toast}
          </p>
        )}

        {/* Primary */}
        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "13px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: sending ? "#D9A99B" : TERRA,
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            cursor: sending ? "default" : "pointer",
          }}
        >
          {sending ? "Sending..." : "Send invite"}
        </button>

        {/* People with access */}
        {collaborators.length > 0 && (
          <div style={{ marginTop: "22px", borderTop: `1px solid ${HAIR}`, paddingTop: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#555", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              People with access
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {collaborators.map((c) => {
                const name = c.familyName ? `${c.familyName} Family` : (c.invitedEmail ?? "Invited");
                const primary = c.role === "OWNER" && c.isYou ? "Owner (You)" : c.isYou ? `${name} (You)` : name;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "13.5px", fontWeight: 600, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {primary}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: MUTED, marginTop: "1px" }}>
                        {roleWord(c.role)}
                        {c.isPending && (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, color: TERRA, backgroundColor: "rgba(196,102,74,0.1)", borderRadius: "999px", padding: "1px 8px" }}>
                            Invited
                          </span>
                        )}
                      </span>
                    </div>
                    {c.isPending && (
                      <button
                        onClick={() => handleRevoke(c.id)}
                        aria-label="Revoke invite"
                        title="Revoke invite"
                        style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: "4px", flexShrink: 0 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Header trigger: an owner-only "Invite" pill matching the trip-header action style.
export function InviteButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      title="Invite to collaborate"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 14px",
        backgroundColor: "transparent",
        color: NAVY,
        border: `1.5px solid ${HAIR}`,
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <UserPlus size={13} /> Invite
    </button>
  );
}
