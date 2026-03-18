import Link from "next/link";

const ENTRIES = [
  {
    version: "v0.9",
    date: "March 2026",
    label: "Early Access Launch",
    changes: [
      "Save any URL from the iOS share sheet",
      "Auto-extraction of venue name, location, and category",
      "Trip creation with day-by-day itinerary view",
      "AI-powered save matching to active trips",
      "Proximity warnings in itinerary builder",
      "Export itinerary to Apple Maps and Google Maps",
      "Family profile with traveler ages and interests",
      "Clerk authentication with Google sign-in",
    ],
  },
];

const COMING_SOON = [
  "Android app",
  "Collaborative trip planning (share with a partner or co-traveler)",
  "Instagram direct integration",
  "TikTok save sync",
  "Hotel check-in date import",
  "Offline itinerary access",
  "Push notifications for booking reminders",
  "Public trip sharing",
];

export default function ChangelogPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Changelog</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            What we&apos;ve built, and what&apos;s next.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            We ship fast and tell you about it. Every update, in plain language.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          {ENTRIES.map((entry) => (
            <div key={entry.version} style={{ display: "flex", gap: "32px", marginBottom: "64px" }}>
              {/* Timeline indicator */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#C4664A", marginTop: "6px" }} />
                <div style={{ width: "2px", flex: 1, backgroundColor: "#E8E8E8", marginTop: "8px" }} />
              </div>
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C" }}>{entry.version}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "#C4664A", color: "#fff", padding: "3px 10px", borderRadius: "999px" }}>{entry.label}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#999", margin: "0 0 20px" }}>{entry.date}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {entry.changes.map((c) => (
                    <li key={c} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ color: "#C4664A", fontWeight: 700, marginTop: "1px", flexShrink: 0 }}>+</span>
                      <span style={{ fontSize: "15px", color: "#444", lineHeight: 1.5 }}>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {/* Coming soon */}
          <div style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "20px", padding: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C" }}>Coming soon</span>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(27,58,92,0.12)", color: "#1B3A5C", padding: "3px 10px", borderRadius: "999px" }}>Roadmap</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {COMING_SOON.map((c) => (
                <li key={c} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span style={{ color: "#999", fontWeight: 700, marginTop: "1px", flexShrink: 0 }}>&bull;</span>
                  <span style={{ fontSize: "15px", color: "#717171", lineHeight: 1.5 }}>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#fff", margin: "0 0 16px" }}>Want early access to new features?</h2>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", margin: "0 0 32px" }}>Pro members get first access to everything on the roadmap.</p>
          <Link href="/sign-up" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Get started &rarr;</Link>
        </div>
      </section>
    </div>
  );
}
