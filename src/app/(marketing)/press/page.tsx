const STATS = [
  { value: "Early Access", label: "Launch stage" },
  { value: "2026", label: "Founded" },
  { value: "Global", label: "Headquarters" },
  { value: "Bootstrapped", label: "Funding" },
];

const ASSETS = [
  "Flokk wordmark (SVG, PNG)",
  "App icon (1024x1024 PNG)",
  "Product screenshots (iPhone 15 Pro)",
  "Founder headshot",
  "Brand color palette",
];

export default function PressPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Press</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Flokk in the press
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            Resources, boilerplate, and contact info for journalists and media.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginBottom: "64px" }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "16px", padding: "28px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 8px" }}>{s.value}</p>
                <p style={{ fontSize: "13px", color: "#717171", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* About Flokk */}
          <div style={{ maxWidth: "720px" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 20px" }}>About Flokk</h2>
            <div style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "32px", border: "1px solid #EEEEEE", marginBottom: "48px" }}>
              <p style={{ fontSize: "15px", color: "#444", lineHeight: 1.8, margin: 0 }}>
                <strong>Flokk</strong> is a family travel platform that rescues the inspiration scattered across your Instagram saves, TikTok reels, and Google Maps stars — and turns it into real, personalized itineraries built around your family. Every recommendation is backed by real trips from real families who&apos;ve already been there. Founded in 2026, independently built and bootstrapped, available globally at <strong>flokktravel.com</strong>.
              </p>
            </div>

            {/* Contact */}
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 20px" }}>Press contact</h2>
            <div style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "32px", border: "1px solid #EEEEEE", marginBottom: "48px" }}>
              <p style={{ fontSize: "15px", color: "#444", margin: "0 0 8px" }}>For press inquiries, interview requests, and fact-checking:</p>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 4px" }}>press@flokktravel.com</p>
              <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>We respond within 24 hours on weekdays (JST).</p>
            </div>

            {/* Assets */}
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 20px" }}>Press assets</h2>
            <div style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "32px", border: "1px solid #EEEEEE" }}>
              <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 20px" }}>Available on request via press@flokktravel.com:</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {ASSETS.map((a) => (
                  <li key={a} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#C4664A", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", color: "#444" }}>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
