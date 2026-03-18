import Link from "next/link";

const COMMITMENTS = [
  {
    title: "WCAG 2.1 AA target",
    body: "We are actively working toward compliance with the Web Content Accessibility Guidelines 2.1 at Level AA. We test with screen readers and keyboard navigation as part of our standard development process.",
  },
  {
    title: "Keyboard navigation",
    body: "All core features of Flokk are operable via keyboard. Focus states are visible throughout the interface. We test tab order and focus management on every release.",
  },
  {
    title: "Screen reader support",
    body: "We test with VoiceOver on iOS and macOS and aim for full compatibility. Images include alt text. Interactive elements have descriptive labels. Form fields are properly associated with their labels.",
  },
  {
    title: "Color and contrast",
    body: "Text and interactive elements meet WCAG AA contrast ratio requirements. We do not rely on color alone to convey information. Our interface is designed to work for users with color vision deficiencies.",
  },
  {
    title: "Text sizing",
    body: "Flokk respects system font size preferences. Text can be increased up to 200% without loss of functionality. We avoid fixed pixel sizes for text.",
  },
  {
    title: "Motion and animation",
    body: "We respect the prefers-reduced-motion system setting. Users who have enabled reduced motion will see minimal or no animations throughout the app.",
  },
];

export default function AccessibilityPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "12px" }}>Accessibility</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>Accessibility Statement</h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", maxWidth: "560px", margin: 0, lineHeight: 1.6 }}>
            Flokk is committed to making family travel accessible to everyone. We believe accessibility is a baseline requirement, not a feature.
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: "0 0 56px" }}>
            We are an early-stage product and we know our accessibility work is ongoing. This page describes what we currently support, what we are working on, and how to report issues.
          </p>

          {/* Commitments grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "56px" }}>
            {COMMITMENTS.map((c) => (
              <div key={c.title} style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "16px", padding: "24px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{c.title}</h2>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>

          {/* Known issues */}
          <div style={{ marginBottom: "48px" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Known limitations</h2>
            <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8 }}>
              As an early access product, we know some parts of Flokk are not yet fully accessible. We are actively addressing these areas and will update this page as issues are resolved. If you encounter a barrier, please report it to us directly.
            </p>
          </div>

          {/* Contact */}
          <div style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "32px", border: "1px solid #EEEEEE" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>Report an accessibility issue</h2>
            <p style={{ fontSize: "15px", color: "#717171", lineHeight: 1.7, margin: "0 0 20px" }}>
              If you encounter an accessibility barrier in Flokk, we want to hear about it. Email us at <strong>accessibility@flokktravel.com</strong> and we will respond within 2 business days.
            </p>
            <Link href="/contact" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "10px 24px", borderRadius: "999px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>Contact us &rarr;</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
