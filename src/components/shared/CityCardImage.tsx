"use client";

import { useState } from "react";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });

interface Props {
  src: string | null;
  alt: string;
}

// Renders a city/country card image with a navy brand fallback when the source
// is null or fails to load. Never shows a broken-image glyph.
export function CityCardImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#1B3A5C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 12px",
        }}
      >
        <span
          className={playfair.className}
          style={{
            color: "rgba(255,255,255,0.9)",
            fontSize: "15px",
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {alt}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}
