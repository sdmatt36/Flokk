import Link from "next/link";

const BELIEFS = [
  {
    title: "Planning should be half the fun",
    body: "We believe the anticipation of a trip is part of the trip itself. Flokk is designed to make the planning phase something families look forward to, not dread.",
  },
  {
    title: "Your saves are an intention, not a to-do list",
    body: "When you save something, you mean it. We take that seriously and make sure your saves become real experiences, not forgotten screenshots.",
  },
  {
    title: "Family travel is its own category",
    body: "Traveling with kids is fundamentally different from traveling solo or as a couple. The tools that serve one don\u2019t serve the other. Flokk was built exclusively for families.",
  },
  {
    title: "Bootstrapped means honest",
    body: "We\u2019re independently funded. That means we build what\u2019s good for families, not what\u2019s good for advertisers. We will never sell your data or show you ads.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>About</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "760px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Built by a family that got tired of losing the list.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "580px", margin: "0 auto", lineHeight: 1.6 }}>
            Flokk started as a personal problem. It became an obsession. Now it's a product families can actually use.
          </p>
        </div>
      </section>

      {/* Founder story */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 32px" }}>The story</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              My family moves a lot. We've lived in three countries and taken more trips than I can count. Every time we plan one, the same thing happens: I spend hours scrolling Instagram saves, Googling restaurants I already found once, and trying to remember which TikTok had that hotel in it.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              The information is out there. The problem is that it's everywhere. In saves, in screenshots, in group chats, in browser tabs. None of it is connected, and none of it knows anything about my family.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              Flokk is the product I wanted. One place to save anything, that remembers what my kids like, that knows where I'm going, and that helps me build a plan that actually works when we get there.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We're independent, fully bootstrapped, and based in Kamakura, Japan. We build slowly and deliberately, and we care a lot about getting this right.
            </p>
          </div>
        </div>
      </section>

      {/* Beliefs */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>What we believe</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
            {BELIEFS.map((b) => (
              <div key={b.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "32px", border: "1px solid #F0F0F0" }}>
                <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>{b.title}</h3>
                <p style={{ fontSize: "15px", color: "#717171", lineHeight: 1.7, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proudly independent */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "40px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>Proudly independent.</h2>
            <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", margin: 0 }}>No investors. No ads. No BS.</p>
          </div>
          <Link href="/contact" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Get in touch &rarr;</Link>
        </div>
      </section>
    </div>
  );
}
