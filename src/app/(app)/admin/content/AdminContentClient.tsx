"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ContentItem = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  destination?: string | null;
  contentType?: string | null;
  ageGroup?: string | null;
  tags?: string[];
  status: string;
  submittedAt: string;
  publicationDate?: string | null;
  submittedBy?: string | null;
  rejectionReason?: string | null;
  sourceUrl?: string | null;
  videoUrl?: string | null;
  itemType: "article" | "video";
};

const ADMIN_TOPIC_TAGS = ["Packing", "Disney", "Family", "Budget", "Food", "Adventure", "Beach", "Culture", "Safety", "Flights", "Hotels", "Theme Parks", "Road Trips", "Cruises"] as const;

const APPROVAL_CHECKLIST = [
  "Relevant to family travel planning",
  "Real experience — not generic or AI-written",
  "Not promotional or affiliate-first",
  "Destination is clearly identified",
  "Appropriate for families with children",
  "Content is reasonably current (post-2020)",
];

type EditFields = { title: string; url: string; contentType: string; destination: string; ageGroup: string; tags: string[]; description: string };

function BetaInviteForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !firstName.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/send-beta-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim(), firstName: firstName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Send failed");
      }
      setStatus("success");
      setEmail("");
      setFirstName("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #E8E8E8", borderRadius: "12px", padding: "20px 24px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
          Send Beta Invite
        </p>
        <a href="/admin/email-preview" target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#C4664A", textDecoration: "none", fontWeight: 500 }}>
          Preview email
        </a>
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Sarah"
            required
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ flex: "2 1 220px" }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#717171", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sarah@example.com"
            required
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #E5E5E5", fontSize: "14px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          style={{ flexShrink: 0, padding: "9px 20px", borderRadius: "8px", border: "none", backgroundColor: status === "sending" ? "#E5E5E5" : "#C4664A", color: status === "sending" ? "#aaa" : "#fff", fontSize: "14px", fontWeight: 700, cursor: status === "sending" ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          {status === "sending" ? "Sending…" : "Send invite"}
        </button>
      </form>
      {status === "success" && (
        <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600, margin: "10px 0 0" }}>
          Invite sent successfully.
        </p>
      )}
      {status === "error" && (
        <p style={{ fontSize: "13px", color: "#C4664A", fontWeight: 600, margin: "10px 0 0" }}>
          Error: {errorMsg}
        </p>
      )}
    </div>
  );
}

export function AdminContentClient() {
  const [items, setItems] = useState<{ articles: ContentItem[]; videos: ContentItem[] }>({
    articles: [],
    videos: [],
  });
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({ title: "", url: "", contentType: "", destination: "", ageGroup: "", tags: [], description: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setActiveItem(null);
    fetch(`/api/admin/content?status=${status}`)
      .then((r) => r.json())
      .then((d) => {
        setItems({
          articles: (d.articles ?? []).map((a: ContentItem) => ({ ...a, itemType: "article" })),
          videos: (d.videos ?? []).map((v: ContentItem) => ({ ...v, itemType: "video" })),
        });
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [status]);

  const allItems = [
    ...items.articles,
    ...items.videos,
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  function selectItem(item: ContentItem) {
    setActiveItem(item);
    setRejectionReason("");
    setChecklist({});
  }

  async function handleAction(action: "approve" | "reject") {
    if (!activeItem) return;
    if (action === "reject" && !rejectionReason.trim()) {
      alert("Please add a rejection reason before rejecting.");
      return;
    }
    setIsActing(true);
    try {
      const res = await fetch(`/api/admin/content/${activeItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          type: activeItem.itemType,
          rejectionReason: action === "reject" ? rejectionReason : null,
        }),
      });
      if (!res.ok) throw new Error("action failed");
      setItems((prev) => ({
        articles: prev.articles.filter((a) => a.id !== activeItem.id),
        videos: prev.videos.filter((v) => v.id !== activeItem.id),
      }));
      setActiveItem(null);
      setRejectionReason("");
      setChecklist({});
    } catch {
      alert("Something went wrong. Try again.");
    } finally {
      setIsActing(false);
    }
  }

  function openEditModal(item: ContentItem) {
    setEditingItem(item);
    setEditFields({
      title: item.title ?? "",
      url: item.sourceUrl ?? item.videoUrl ?? "",
      contentType: item.contentType ?? "",
      destination: item.destination ?? "",
      ageGroup: item.ageGroup ?? "",
      tags: item.tags ?? [],
      description: "",
    });
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/content/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          type: editingItem.itemType,
          title: editFields.title,
          url: editFields.url,
          contentType: editFields.contentType,
          destination: editFields.destination,
          ageGroup: editFields.ageGroup,
          tags: editFields.tags.length > 0 ? editFields.tags : undefined,
          description: editFields.description || undefined,
        }),
      });
      if (!res.ok) throw new Error("edit failed");
      const updated = await res.json() as ContentItem;
      const patch = { ...editingItem, ...updated };
      setItems(prev => ({
        articles: prev.articles.map(a => a.id === editingItem.id ? { ...patch, itemType: "article" as const } : a),
        videos: prev.videos.map(v => v.id === editingItem.id ? { ...patch, itemType: "video" as const } : v),
      }));
      if (activeItem?.id === editingItem.id) setActiveItem(patch as ContentItem);
      setEditingItem(null);
    } catch {
      alert("Edit failed. Try again.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(item: ContentItem) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/content/${item.id}?type=${item.itemType}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setItems(prev => ({
        articles: prev.articles.filter(a => a.id !== item.id),
        videos: prev.videos.filter(v => v.id !== item.id),
      }));
      if (activeItem?.id === item.id) setActiveItem(null);
    } catch {
      alert("Delete failed. Try again.");
    }
  }

  const pendingCount = allItems.length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F5F5" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#1B3A5C", padding: "20px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
              Flokk Admin
            </p>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0 }}>Content Queue</h1>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>
              Review and approve submitted articles and videos
            </p>
          </div>
          <Link href="/home" style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>
            ← Exit admin
          </Link>
        </div>
      </div>

      {/* Beta invite form */}
      <div style={{ maxWidth: "1200px", margin: "20px auto 0", padding: "0 24px" }}>
        <BetaInviteForm />
      </div>

      {/* Status tabs */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #E8E8E8" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px", display: "flex", gap: "0" }}>
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: "14px 20px",
                fontSize: "13px",
                fontWeight: status === s ? 700 : 500,
                color: status === s ? "#1B3A5C" : "#888",
                background: "none",
                border: "none",
                borderBottom: status === s ? "2px solid #1B3A5C" : "2px solid transparent",
                cursor: "pointer",
                textTransform: "capitalize",
                fontFamily: "inherit",
                marginBottom: "-1px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {s}
              {s === "pending" && pendingCount > 0 && (
                <span style={{ backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, borderRadius: "999px", padding: "1px 7px" }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px", display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px", alignItems: "start" }}>

        {/* Left — item list */}
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", overflow: "hidden" }}>
          {isLoading ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <p style={{ color: "#717171", fontSize: "14px" }}>Loading…</p>
            </div>
          ) : allItems.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>✓</p>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>Queue empty</p>
              <p style={{ fontSize: "13px", color: "#717171" }}>No {status} content</p>
            </div>
          ) : (
            <div>
              {allItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #F0F0F0",
                    borderLeft: activeItem?.id === item.id ? "3px solid #1B3A5C" : "3px solid transparent",
                    background: activeItem?.id === item.id ? "rgba(27,58,92,0.05)" : "none",
                    display: "flex",
                    alignItems: "stretch",
                  }}
                >
                <button
                  onClick={() => selectItem(item)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "14px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ width: "52px", height: "52px", borderRadius: "8px", backgroundColor: "#F0F0F0", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: "22px" }}>{item.itemType === "video" ? "🎬" : "📄"}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                    <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", fontWeight: 600, backgroundColor: item.itemType === "video" ? "rgba(196,102,74,0.1)" : "rgba(27,58,92,0.08)", color: item.itemType === "video" ? "#C4664A" : "#1B3A5C", borderRadius: "999px", padding: "2px 7px" }}>
                        {item.itemType}
                      </span>
                      {item.destination && (
                        <span style={{ fontSize: "10px", color: "#717171" }}>📍 {item.destination}</span>
                      )}
                    </div>
                    <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "4px 0 0" }}>
                      Submitted {new Date(item.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {item.publicationDate && (
                      <p style={{ fontSize: "11px", color: "#AAAAAA", margin: "2px 0 0" }}>
                        Published {new Date(item.publicationDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "10px 10px 10px 0", justifyContent: "center" }}>
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: "4px 8px", borderRadius: "6px", color: "#555" }}>✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: "4px 8px", borderRadius: "6px", color: "#e53e3e" }}>🗑️</button>
                </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — review panel */}
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8", overflow: "hidden", position: "sticky", top: "24px" }}>
          {!activeItem ? (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>👈</p>
              <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "4px" }}>Select an item</p>
              <p style={{ fontSize: "13px", color: "#717171" }}>Choose an item from the list to review it</p>
            </div>
          ) : (
            <div>
              {activeItem.thumbnailUrl && (
                <div style={{ height: "200px", overflow: "hidden" }}>
                  <img src={activeItem.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <div style={{ padding: "24px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: "0 0 12px", lineHeight: 1.3 }}>
                  {activeItem.title}
                </h2>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: activeItem.itemType === "video" ? "rgba(196,102,74,0.1)" : "rgba(27,58,92,0.08)", color: activeItem.itemType === "video" ? "#C4664A" : "#1B3A5C", borderRadius: "999px", padding: "3px 10px" }}>
                    {activeItem.itemType}
                  </span>
                  {activeItem.contentType && (
                    <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: "#F5F5F5", color: "#717171", borderRadius: "999px", padding: "3px 10px" }}>
                      {activeItem.contentType}
                    </span>
                  )}
                  {activeItem.destination && (
                    <span style={{ fontSize: "11px", color: "#717171", backgroundColor: "#F5F5F5", borderRadius: "999px", padding: "3px 10px" }}>
                      📍 {activeItem.destination}
                    </span>
                  )}
                  {activeItem.ageGroup && (
                    <span style={{ fontSize: "11px", color: "#717171", backgroundColor: "#F5F5F5", borderRadius: "999px", padding: "3px 10px" }}>
                      👨‍👩‍👧 {activeItem.ageGroup}
                    </span>
                  )}
                </div>

                {(activeItem.sourceUrl ?? activeItem.videoUrl) && (
                  <a
                    href={activeItem.sourceUrl ?? activeItem.videoUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", fontSize: "13px", color: "#C4664A", fontWeight: 600, marginBottom: "12px", textDecoration: "none" }}
                  >
                    Open original →
                  </a>
                )}
                <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#AAAAAA" }}>
                    Submitted {new Date(activeItem.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {activeItem.publicationDate && (
                    <span style={{ fontSize: "12px", color: "#AAAAAA" }}>
                      Published {new Date(activeItem.publicationDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>

                {activeItem.status === "pending" && (
                  <div style={{ backgroundColor: "#F9F9F9", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
                      Approval checklist
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {APPROVAL_CHECKLIST.map((criterion) => (
                        <label key={criterion} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={!!checklist[criterion]}
                            onChange={(e) =>
                              setChecklist((prev) => ({ ...prev, [criterion]: e.target.checked }))
                            }
                            style={{ marginTop: "2px", accentColor: "#1B3A5C", flexShrink: 0 }}
                          />
                          <span style={{ fontSize: "13px", color: "#1a1a1a", lineHeight: 1.4 }}>{criterion}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {activeItem.status !== "pending" && (
                  <div style={{ backgroundColor: activeItem.status === "approved" ? "rgba(27,58,92,0.05)" : "rgba(196,102,74,0.06)", borderRadius: "10px", padding: "14px", marginBottom: "20px", border: `1px solid ${activeItem.status === "approved" ? "rgba(27,58,92,0.12)" : "rgba(196,102,74,0.15)"}` }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: activeItem.status === "approved" ? "#1B3A5C" : "#C4664A", margin: "0 0 4px" }}>
                      {activeItem.status === "approved" ? "✓ Approved" : "✗ Rejected"}
                    </p>
                    {activeItem.rejectionReason && (
                      <p style={{ fontSize: "12px", color: "#717171", margin: 0, lineHeight: 1.5 }}>
                        Reason: {activeItem.rejectionReason}
                      </p>
                    )}
                  </div>
                )}

                {activeItem.status === "pending" && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "6px" }}>
                      Rejection reason <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(required if rejecting)</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Promotional content, not family-focused, outdated destination info…"
                      rows={3}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E5E5E5", borderRadius: "10px", fontSize: "13px", color: "#1a1a1a", resize: "vertical", outline: "none", lineHeight: 1.5, boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                )}

                {activeItem.status === "pending" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={isActing}
                      style={{ padding: "12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", color: "#C4664A", fontSize: "14px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.5 : 1, fontFamily: "inherit", transition: "opacity 0.15s" }}
                    >
                      ✗ Reject
                    </button>
                    <button
                      onClick={() => handleAction("approve")}
                      disabled={isActing}
                      style={{ padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", opacity: isActing ? 0.5 : 1, fontFamily: "inherit", transition: "opacity 0.15s" }}
                    >
                      ✓ Approve
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    onClick={() => openEditModal(activeItem)}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", color: "#1B3A5C", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    ✏️ Edit fields
                  </button>
                  <button
                    onClick={() => handleDelete(activeItem)}
                    style={{ padding: "10px 16px", borderRadius: "10px", border: "1.5px solid rgba(229,62,62,0.3)", backgroundColor: "#fff", color: "#e53e3e", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div
          onClick={() => setEditingItem(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#fff", borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", padding: "28px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Edit submission</h2>
              <button onClick={() => setEditingItem(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#999", lineHeight: 1 }}>×</button>
            </div>

            {([ ["title", "Title", "text"], ["url", "URL", "url"], ["contentType", "Content Type", "text"], ["destination", "Destination", "text"], ["ageGroup", "Age Group", "text"], ["description", "Description", "textarea"] ] as [keyof EditFields, string, string][]).map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "5px" }}>{label}</label>
                {type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={editFields[field] as string}
                    onChange={e => setEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "13px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                  />
                ) : (
                  <input
                    type={type}
                    value={editFields[field] as string}
                    onChange={e => setEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", fontSize: "13px", color: "#1a1a1a", outline: "none", boxSizing: "border-box", backgroundColor: "#fff" }}
                  />
                )}
              </div>
            ))}

            {/* Topic tag pills */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px" }}>Topic Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {ADMIN_TOPIC_TAGS.map((tag) => {
                  const active = editFields.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditFields(prev => ({
                        ...prev,
                        tags: active ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
                      }))}
                      style={{ padding: "5px 12px", borderRadius: "999px", border: "1.5px solid", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderColor: active ? "#1B3A5C" : "#E8E8E8", backgroundColor: active ? "#1B3A5C" : "#fff", color: active ? "#fff" : "#717171" }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setEditingItem(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1.5px solid #E5E5E5", backgroundColor: "#fff", color: "#717171", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: isSavingEdit ? "not-allowed" : "pointer", opacity: isSavingEdit ? 0.6 : 1, fontFamily: "inherit" }}>
                {isSavingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
