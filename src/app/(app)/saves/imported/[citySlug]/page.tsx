"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { SaveCard, mapApiItem } from "@/components/features/saves/SaveCard";
import type { ApiItem, Save } from "@/components/features/saves/SaveCard";

type CityData = {
  name: string;
  slug: string;
  photoUrl: string | null;
};

type TripRow = { id: string; title: string; endDate?: string | null };

export default function ImportedCityPage() {
  const params = useParams<{ citySlug: string }>();
  const router = useRouter();
  const citySlug = params.citySlug;

  const [city, setCity] = useState<CityData | null>(null);
  const [saves, setSaves] = useState<Save[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [allCount, setAllCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<TripRow[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [ratedItemId, setRatedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!citySlug) return;

    fetch(`/api/saves/city/${citySlug}?scope=imports`)
      .then((r) => r.json())
      .then((data: { city: CityData; saves: ApiItem[]; scope: string }) => {
        setCity(data.city ?? null);
        setSaves((data.saves ?? []).map(mapApiItem));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`/api/saves/city/${citySlug}?scope=all`)
      .then((r) => r.json())
      .then((data: { saves: unknown[] }) => setAllCount(data.saves?.length ?? 0))
      .catch(() => {});

    fetch("/api/trips?status=ALL")
      .then((r) => r.json())
      .then((data: { trips?: TripRow[] }) => setAvailableTrips(data.trips ?? []))
      .catch(() => {});
  }, [citySlug]);

  async function handleShare(scope: "imports" | "all") {
    if (!citySlug) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/saves/city-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citySlug, scope }),
      });
      if (!res.ok) throw new Error("Failed");
      const { url } = (await res.json()) as { url: string };
      if (navigator.share) {
        await navigator.share({ title: `My saves in ${city?.name ?? citySlug}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // ignore
    } finally {
      setShareLoading(false);
      setSharePopupOpen(false);
    }
  }

  function handleDeleted(id: string) {
    setSaves((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAssignTrip(id: string, tripTitle: string) {
    setOpenDropdown(null);
    // Navigate to saves to handle trip creation/assignment flow
    if (tripTitle === "+ Create new trip") {
      router.push("/saves");
      return;
    }
    const trip = availableTrips.find((t) => t.title === tripTitle);
    if (!trip) return;
    fetch(`/api/saves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: trip.id }),
    }).catch(() => {});
    setSaves((prev) => prev.map((s) => s.id === id ? { ...s, tripId: trip.id, assigned: trip.title } : s));
  }

  if (loading) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  const heroUrl = city?.photoUrl ?? null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 80px" }}>
      {/* Hero */}
      {heroUrl && (
        <div style={{ height: 200, borderRadius: 16, overflow: "hidden", marginBottom: 24, marginTop: 16 }}>
          <img src={heroUrl} alt={city?.name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, marginTop: heroUrl ? 0 : 24 }}>
        <div>
          <button
            type="button"
            onClick={() => router.push("/saves?tab=imported")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#717171", padding: 0, marginBottom: 6, display: "block" }}
          >
            Back to Imported
          </button>
          <h1 style={{ fontFamily: "var(--font-playfair), 'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#1B3A5C", margin: 0 }}>
            {city?.name ?? citySlug}
          </h1>
          <p style={{ fontSize: 13, color: "#717171", margin: "4px 0 0" }}>
            {saves.length} {saves.length === 1 ? "import" : "imports"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSharePopupOpen(true)}
          style={{
            padding: "9px 16px",
            borderRadius: 20,
            border: "1.5px solid #C4664A",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#C4664A",
          }}
        >
          Share
        </button>
      </div>

      {/* Save cards */}
      {saves.length === 0 ? (
        <p style={{ color: "#6B7280", textAlign: "center", padding: "40px 0", fontSize: 14 }}>
          No imported saves found for this city.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {saves.map((save) => (
            <SaveCard
              key={save.id}
              save={save}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              assignTrip={handleAssignTrip}
              onTripClick={() => {}}
              onCardClick={() => {}}
              availableTrips={availableTrips}
              onDeleted={handleDeleted}
              onRateClick={(id, title) => setRatedItemId(id)}
              ratedItemId={ratedItemId}
            />
          ))}
        </div>
      )}

      {/* Share popup */}
      {sharePopupOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.35)" }}
          onClick={() => setSharePopupOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontWeight: 700, fontSize: 16, color: "#1B3A5C", marginBottom: 6 }}>
              Share {city?.name ?? citySlug}
            </p>
            <p style={{ fontSize: 13, color: "#717171", marginBottom: 20 }}>
              Choose what to include in your shared link.
            </p>

            <button
              type="button"
              disabled={shareLoading}
              onClick={() => handleShare("imports")}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12, border: "1px solid #EEEEEE", background: "#FAFAFA", cursor: "pointer", marginBottom: 10, opacity: shareLoading ? 0.6 : 1 }}
            >
              <p style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C", marginBottom: 2 }}>
                {shareLoading ? "Generating link..." : `Just my Google Maps imports (${saves.length})`}
              </p>
              <p style={{ fontSize: 12, color: "#717171" }}>Only your imported Google Maps saves</p>
            </button>

            <button
              type="button"
              disabled={shareLoading}
              onClick={() => handleShare("all")}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12, border: "1px solid #EEEEEE", background: "#FAFAFA", cursor: "pointer", marginBottom: 16, opacity: shareLoading ? 0.6 : 1 }}
            >
              <p style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C", marginBottom: 2 }}>
                {shareLoading ? "Generating link..." : `Everything I've saved in ${city?.name ?? citySlug} (${allCount})`}
              </p>
              <p style={{ fontSize: 12, color: "#717171" }}>All saves including trip-assigned ones</p>
            </button>

            {copied && (
              <p style={{ fontSize: 13, color: "#C4664A", textAlign: "center", marginBottom: 12 }}>Link copied to clipboard</p>
            )}

            <button
              type="button"
              onClick={() => setSharePopupOpen(false)}
              style={{ display: "block", width: "100%", textAlign: "center", padding: 12, borderRadius: 10, border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#717171" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
