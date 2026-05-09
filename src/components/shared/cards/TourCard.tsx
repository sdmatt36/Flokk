"use client";

import { useState } from "react";
import Link from "next/link";
import { getTripCoverImage } from "@/lib/destination-images";
import { invokeNativeShare, copyToClipboard } from "@/lib/share";

export interface TourCardItem {
  id: string;
  title: string;
  destinationCity: string;
  destinationCountry?: string | null;
  shareToken: string | null;
  stopCount: number;
  transport?: string | null;
  firstStopImageUrl?: string | null;
}

const TERRA = "#C4664A";
const NAVY = "#1B3A5C";
const GRAY_200 = "#E5E7EB";

export function TourCard({ tour }: { tour: TourCardItem }) {
  const [copied, setCopied] = useState(false);
  const coverImage = getTripCoverImage(
    tour.destinationCity,
    tour.destinationCountry ?? null,
    tour.firstStopImageUrl ?? null,
  );
  const destination = [tour.destinationCity, tour.destinationCountry]
    .filter(Boolean)
    .join(", ");
  const cardHref = tour.shareToken ? `/s/${tour.shareToken}` : "#";

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
      className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid #EEEEEE",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Clickable header: image + meta */}
      <Link href={cardHref} style={{ textDecoration: "none", display: "block" }}>
        <div
          style={{
            height: "160px",
            backgroundImage: `url(${coverImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: "10px", left: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                backgroundColor: TERRA,
                color: "#fff",
                borderRadius: "20px",
                padding: "3px 10px",
              }}
            >
              {tour.destinationCity}
            </span>
          </div>
          {tour.transport && (
            <div style={{ position: "absolute", top: "10px", right: "10px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  backgroundColor: "rgba(27,58,92,0.85)",
                  backdropFilter: "blur(4px)",
                  color: "#fff",
                  borderRadius: "20px",
                  padding: "3px 10px",
                }}
              >
                {tour.transport}
              </span>
            </div>
          )}
        </div>
        <div style={{ padding: "14px 16px 10px" }}>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#1a1a1a",
              marginBottom: "4px",
              lineHeight: 1.4,
            }}
          >
            {tour.title}
          </p>
          <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5 }}>
            {[`${tour.stopCount} stop${tour.stopCount === 1 ? "" : "s"}`, destination]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </Link>

      {/* Action row — sits below the link, not inside it */}
      <div
        style={{ padding: "0 16px 14px", display: "flex", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={cardHref}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            backgroundColor: TERRA,
            color: "#fff",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
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
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "7px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: "#fff",
              color: NAVY,
              border: `1px solid ${GRAY_200}`,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {copied ? "Copied!" : "Share"}
          </button>
        )}
      </div>
    </div>
  );
}
