"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";

const CARD_SUGGESTIONS = [
  "Chase Sapphire Reserve",
  "Chase Sapphire Preferred",
  "Amex Platinum",
  "Amex Gold",
  "Capital One Venture X",
  "Capital One Venture",
  "Citi Premier",
  "Bilt Mastercard",
  "Bank of America Premium Rewards",
  "Wells Fargo Autograph",
];

const NETWORKS = ["Visa", "Mastercard", "American Express", "Discover", "Other"];

interface CardEntry {
  id: string;
  cardType: "personal" | "travel";
  cardName: string;
  network: string;
  lastFour: string | null;
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #E8E8E8",
  borderRadius: "8px", fontSize: "14px", color: "#1a1a1a",
  outline: "none", boxSizing: "border-box", backgroundColor: "#fff",
};

const labelSt: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600, color: "#717171",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px",
};

function CardModal({ onClose, onAdd }: { onClose: () => void; onAdd: (card: Omit<CardEntry, "id">) => Promise<void> }) {
  const [cardType, setCardType] = useState<"personal" | "travel">("travel");
  const [cardName, setCardName] = useState("");
  const [network, setNetwork] = useState("");
  const [last4, setLast4] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    await onAdd({
      cardType,
      cardName: cardName.trim() || "Card",
      network: network || "Other",
      lastFour: last4 || null,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", padding: "32px",
        width: "100%", maxWidth: "520px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        position: "relative",
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "20px", right: "20px",
            background: "none", border: "none", cursor: "pointer", padding: "4px",
          }}
        >
          <X size={20} style={{ color: "#717171" }} />
        </button>

        <p style={{ fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>
          Add a travel card
        </p>
        <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 24px", lineHeight: 1.5 }}>
          We&apos;ll surface relevant perks and rewards when you&apos;re planning trips.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Card type */}
          <div>
            <p style={labelSt}>Card type</p>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["personal", "travel"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCardType(t)}
                  style={{
                    flex: 1, padding: "9px 12px", fontSize: "14px", borderRadius: "8px",
                    border: `1px solid ${cardType === t ? "#1B3A5C" : "#E8E8E8"}`,
                    backgroundColor: cardType === t ? "#1B3A5C" : "#fff",
                    color: cardType === t ? "#fff" : "#717171",
                    fontWeight: cardType === t ? 500 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t === "personal" ? "Personal card" : "Travel rewards card"}
                </button>
              ))}
            </div>
          </div>

          {/* Card name */}
          <div>
            <label style={labelSt}>Card name</label>
            <input
              style={inputSt}
              list="card-suggestions-list"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Search or type card name"
            />
            <datalist id="card-suggestions-list">
              {CARD_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Network */}
          <div>
            <p style={labelSt}>Card network</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", flexDirection: "row" }}>
              {NETWORKS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  style={{
                    padding: "7px 14px", borderRadius: "999px", fontSize: "13px",
                    border: `1px solid ${network === n ? "#1B3A5C" : "#E8E8E8"}`,
                    backgroundColor: network === n ? "#1B3A5C" : "#fff",
                    color: network === n ? "#fff" : "#717171",
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Last 4 */}
          <div>
            <label style={labelSt}>Last 4 digits</label>
            <input
              style={inputSt}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
            />
            <p style={{ fontSize: "12px", color: "#717171", marginTop: "4px", marginBottom: 0 }}>
              We never store full card numbers.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#717171", padding: 0 }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              backgroundColor: "#1B3A5C", color: "#fff", border: "none",
              borderRadius: "8px", padding: "10px 24px", fontSize: "14px",
              fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Add card"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NetworkInitial({ network }: { network: string }) {
  const initial = network[0]?.toUpperCase() ?? "?";
  return (
    <div style={{
      width: "36px", height: "24px", backgroundColor: "#F5F5F5",
      borderRadius: "4px", display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#717171" }}>{initial}</span>
    </div>
  );
}

export function PaymentSection() {
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/payment")
      .then((r) => r.json())
      .then((data: Array<{ id: string; cardName: string; cardType: string; network: string; lastFour: string | null }>) => {
        if (!Array.isArray(data)) return;
        setCards(data.map((c) => ({
          id: c.id,
          cardName: c.cardName,
          cardType: c.cardType as "personal" | "travel",
          network: c.network,
          lastFour: c.lastFour,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(card: Omit<CardEntry, "id">) {
    const res = await fetch("/api/profile/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardName: card.cardName,
        cardType: card.cardType,
        network: card.network,
        lastFour: card.lastFour,
      }),
    });
    if (!res.ok) return;
    const saved = await res.json();
    setCards((c) => [...c, {
      id: saved.id,
      cardName: saved.cardName,
      cardType: saved.cardType,
      network: saved.network,
      lastFour: saved.lastFour,
    }]);
  }

  async function removeCard(id: string) {
    await fetch(`/api/profile/payment?id=${id}`, { method: "DELETE" });
    setCards((c) => c.filter((x) => x.id !== id));
  }

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  return (
    <>
      {showModal && (
        <CardModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {cards.length === 0 ? (
          <div style={{
            backgroundColor: "#fff", borderRadius: "12px",
            border: "1px dashed #E8E8E8", padding: "48px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          }}>
            <p style={{ color: "#1B3A5C", fontWeight: 500, fontSize: "15px", margin: "0 0 0" }}>
              No payment methods yet
            </p>
            <p style={{ color: "#717171", fontSize: "14px", maxWidth: "360px", marginTop: "8px", lineHeight: 1.5 }}>
              Add the cards you use for travel. We&apos;ll surface relevant perks and rewards during trip planning.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: "#1B3A5C", color: "#fff", border: "none",
                borderRadius: "8px", padding: "9px 20px", fontSize: "14px",
                fontWeight: 500, cursor: "pointer", marginTop: "16px",
              }}
            >
              + Add card
            </button>
          </div>
        ) : (
          <>
            {cards.map((card) => (
              <div key={card.id} style={{
                backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E8E8E8",
                padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <NetworkInitial network={card.network} />
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#1B3A5C", margin: 0 }}>
                      {card.cardName}
                    </p>
                    <p style={{ fontSize: "13px", color: "#717171", margin: "2px 0 0" }}>
                      {card.lastFour ? `•••• ${card.lastFour}` : card.network}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 10px", borderRadius: "999px",
                    backgroundColor: card.cardType === "travel" ? "rgba(27,58,92,0.08)" : "#F5F5F5",
                    color: card.cardType === "travel" ? "#1B3A5C" : "#717171",
                  }}>
                    {card.cardType === "travel" ? "Travel rewards" : "Personal"}
                  </span>
                  <button
                    onClick={() => removeCard(card.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                  >
                    <Trash2 size={16} style={{ color: "#717171" }} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowModal(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "14px", color: "#C4664A", fontWeight: 500,
                padding: "8px 0", textAlign: "left",
              }}
            >
              + Add another card
            </button>
          </>
        )}

        <p style={{ color: "#717171", fontSize: "12px", textAlign: "center", marginTop: "4px" }}>
          Full card integration and travel benefit tracking coming in a future update.
        </p>
      </div>
    </>
  );
}
