import Link from "next/link";

const TIERS = [
  {
    name: "Explorer",
    description: "New to Flokk. Share your first save, introduce yourself, and get feedback on your first trip plan.",
    perks: ["Access to community forums", "Trip inspiration feed", "Weekly digest email"],
  },
  {
    name: "Planner",
    description: "Active community contributor. You&apos;ve shared at least 5 trips and helped other families plan theirs.",
    perks: ["Early access to beta features", "Monthly community Q&A with the Flokk team", "Planner badge on your profile"],
  },
  {
    name: "Navigator",
    description: "Power contributor. You&apos;re a trusted voice in the community and a resource for newer members.",
    perks: ["Direct feedback channel with the product team", "Annual Flokk swag", "Navigator badge and featured profile"],
  },
];

const CONTRIBUTE = [
  { title: "Share a trip plan", desc: "Post your day-by-day itinerary after a trip. What worked, what didn&apos;t, what you&apos;d do differently." },
  { title: "Rate a recommendation", desc: "Upvote or comment on saves other families have shared. Your signal helps everyone plan better." },
  { title: "Write a destination guide", desc: "Know a city well? Write a short guide with your family&apos;s top picks for food, activities, and logistics." },
  { title: "Answer a question", desc: "Someone is planning their first trip to your favorite city. Share what you know." },
];

export default function CommunityInfoPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Community</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Real families. Real trips. Real advice.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "520px", margin: "0 auto 36px", lineHeight: 1.6 }}>
            The Flokk community is a place for families to share what they&apos;ve learned, help each other plan, and make every trip a little less stressful.
          </p>
          <Link href="/sign-up" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Join the community &rarr;</Link>
        </div>
      </section>

      {/* Contribute section */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>How to contribute</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
            {CONTRIBUTE.map((c) => (
              <div key={c.title} style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{c.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px", textAlign: "center" }}>Community tiers</h2>
          <p style={{ fontSize: "16px", color: "#717171", margin: "0 0 48px", textAlign: "center", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>The more you contribute, the more access you get. It&apos;s that simple.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {TIERS.map((tier, i) => (
              <div key={tier.name} style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "36px", border: i === 2 ? "2px solid #C4664A" : "1px solid #F0F0F0", position: "relative" }}>
                {i === 2 && (
                  <div style={{ position: "absolute", top: "20px", right: "20px", backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Top tier</div>
                )}
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 12px" }}>{tier.name}</p>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: "0 0 24px" }}>{tier.description}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {tier.perks.map((p) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#C4664A", fontWeight: 700, flexShrink: 0 }}>&#10003;</span>
                      <span style={{ fontSize: "14px", color: "#444" }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
