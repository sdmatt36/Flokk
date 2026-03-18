import Link from "next/link";

const VALUES = [
  {
    title: "Obsess over families",
    body: "Everything we build is for people traveling with kids. We live it ourselves. We build what we need.",
  },
  {
    title: "Ship and learn",
    body: "We move fast. We share things early. We ask families to break our ideas and we&apos;re grateful when they do.",
  },
  {
    title: "Stay lean",
    body: "We&apos;re bootstrapped and plan to stay that way. Every feature has to earn its place. We don&apos;t build for the sake of building.",
  },
  {
    title: "Write clearly",
    body: "Our product should be self-explanatory. Our comms should be direct. We don&apos;t use jargon and we don&apos;t hide behind complexity.",
  },
  {
    title: "Be honest",
    body: "With each other, with our users, and about what we don&apos;t know. We say when something is hard. We admit mistakes early.",
  },
  {
    title: "Actually travel",
    body: "We take trips. We use the product. If a feature doesn&apos;t survive contact with a real family vacation, we fix it.",
  },
];

export default function CareersPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Careers</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            We&apos;re building something small and meaningful.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            Flokk is an independent, bootstrapped product. We&apos;re not a big team, and we&apos;re not trying to be.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>How we work</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {VALUES.map((v) => (
              <div key={v.title} style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{v.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* No open roles */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>No open roles right now</h2>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7, margin: "0 0 32px" }}>
            We&apos;re a small team in early access. When we hire, we move slowly and look for people who genuinely care about family travel. If that&apos;s you, drop us a line. We read every message.
          </p>
          <Link href="/contact" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Say hello &rarr;</Link>
        </div>
      </section>
    </div>
  );
}
