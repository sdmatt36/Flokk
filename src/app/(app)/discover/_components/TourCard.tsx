"use client";

import { useState } from "react";
import Link from "next/link";
import { invokeNativeShare, copyToClipboard } from "@/lib/share";

export type TourCardItem = {
  id: string;
  title: string;
  destinationCity: string;
  shareToken: string | null;
  _count: { stops: number };
  stops: { imageUrl: string | null }[];
};

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";
const GRAY_200 = "#E5E7EB";

export function TourCard({ tour }: { tour: TourCardItem }) {
  const [copied, setCopied] = useState(false);
  const imageUrl = tour.stops[0]?.imageUrl ?? null;
  const href = tour.shareToken ? `/s/${tour.shareToken}` : "#";

  const handleShare = async () => {
    if (!tour.shareToken) return;
    const url = `${window.location.origin}/s/${tour.shareToken}`;
    const { fallback } = await invokeNativeShare(url, tour.title);
    if (fallback) {
      await copyToClipboard(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="group rounded-2xl overflow-hidden border border-[#E8DDC8] bg-[#FBF6EC] hover:shadow-md transition-shadow duration-200"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Clickable header: image + meta */}
      <Link href={href} style={{ textDecoration: "none", display: "block" }}>
        <div className="h-40 w-full overflow-hidden bg-[#E8DDC8]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={tour.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[#1B3A5C]/30 text-xs italic">{tour.destinationCity}</span>
            </div>
          )}
        </div>
        <div className="p-4 pb-2">
          <p className="text-sm font-semibold text-[#1B3A5C] leading-snug line-clamp-2 mb-1">
            {tour.title}
          </p>
          <p className="text-xs text-[#1B3A5C]/60">
            {tour._count.stops} stops · {tour.destinationCity}
          </p>
        </div>
      </Link>

      {/* Action row — sits below the link, not inside it */}
      <div
        style={{ padding: "0 16px 14px", display: "flex", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={href}
          style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            backgroundColor: TERRA, color: "#fff", textDecoration: "none",
          }}
        >
          View tour →
        </Link>
        {tour.shareToken && (
          <button
            type="button"
            onClick={handleShare}
            title="Copy share link"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              backgroundColor: "#fff", color: NAVY, border: `1px solid ${GRAY_200}`,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        )}
      </div>
    </div>
  );
}
