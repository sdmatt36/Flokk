"use client";

import { Sparkles, Users, Heart, MapPin, Bookmark } from "lucide-react";

type Props = {
  style?: React.CSSProperties;
};

const TRACKS = [
  { icon: Users, label: "Who's travelling", hint: "Group size & age mix" },
  { icon: Heart, label: "Your vibe", hint: "Food, culture, adventure…" },
  { icon: MapPin, label: "Where you go", hint: "Cities, regions, countries" },
  { icon: Bookmark, label: "What you save", hint: "Stops you keep & cut" },
];

export default function FlokkLearnsYouPanel({ style }: Props) {
  return (
    <div
      style={{
        flex: "0 0 340px",
        borderRadius: "16px",
        background: "linear-gradient(160deg, #FDF6EE 0%, #FAEAE0 55%, #F5E3D5 100%)",
        border: "1px solid rgba(196,102,74,0.14)",
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        ...style,
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
          <Sparkles size={14} color="#C4664A" />
          <p style={{ fontSize: "11px", color: "#C4664A", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
            FLOKK LEARNS YOU
          </p>
        </div>
        <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 8px", lineHeight: 1.3 }}>
          Better every tour
        </h3>
        <p style={{ fontSize: "13px", color: "#717171", margin: 0, lineHeight: 1.65, fontFamily: "DM Sans, system-ui, sans-serif" }}>
          The more you build, the smarter Flokk gets about your family&apos;s style.
        </p>
      </div>

      <div style={{ borderTop: "1px solid rgba(196,102,74,0.15)" }} />

      {/* What we track */}
      <div>
        <p style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 14px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
          WHAT WE TRACK
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {TRACKS.map(({ icon: Icon, label, hint }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: "8px",
                background: "rgba(196,102,74,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
              }}>
                <Icon size={15} color="#C4664A" />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                  {label}
                </p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0", fontFamily: "DM Sans, system-ui, sans-serif" }}>
                  {hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pro Tip */}
      <div style={{ marginTop: "auto", background: "rgba(27,58,92,0.05)", borderRadius: "12px", padding: "16px" }}>
        <p style={{ fontSize: "11px", color: "#1B3A5C", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 6px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
          PRO TIP
        </p>
        <p style={{ fontSize: "12px", color: "#555", lineHeight: 1.65, margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
          Be specific. &quot;Ramen in Shinjuku for kids under 8&quot; builds a far better tour than &quot;Tokyo food.&quot;
        </p>
      </div>
    </div>
  );
}
