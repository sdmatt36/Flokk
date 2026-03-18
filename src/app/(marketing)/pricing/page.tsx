"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

const FREE_FEATURES = [
  "Up to 50 saves",
  "3 active trips",
  "AI itinerary suggestions",
  "Export to Apple / Google Maps",
  "Family profile (up to 4 travelers)",
];

const PRO_FEATURES = [
  "Unlimited saves",
  "Unlimited trips",
  "Priority AI itinerary builder",
  "Proximity-aware scheduling",
  "Advanced family profiles",
  "Trip history & insights",
  "Early access to new features",
];

const FAQS = [
  {
    q: "Is Flokk really free to start?",
    a: "Yes. The free tier is generous and designed to get you through multiple real trips. We only ask you to upgrade when you hit a limit that actually matters to you.",
  },
  {
    q: "What does Pro cost?",
    a: "Pro is $7.99 / month or $59.99 / year (save 37%). Pricing is per household, not per traveler.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Absolutely. Cancel from your account settings in one click. You keep Pro access until the end of your billing period.",
  },
  {
    q: "Is there a family or group plan?",
    a: "The household plan covers your whole travel group. We don&apos;t charge per seat. A separate collaborative plan for larger groups is on our roadmap.",
  },
  {
    q: "What happens to my saves if I downgrade?",
    a: "Your data is always yours. If you downgrade, we keep all your saves and trips. You just won&apos;t be able to add new ones beyond the free tier limits.",
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Pricing</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Simple pricing, no surprises.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            Start free. Upgrade when you&apos;re ready. One plan for your whole household.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Free */}
          <div style={{ border: "1.5px solid #E8E8E8", borderRadius: "20px", padding: "40px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#717171", margin: "0 0 16px" }}>Free</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "48px", fontWeight: 700, color: "#1B3A5C" }}>$0</span>
              <span style={{ fontSize: "14px", color: "#717171" }}>/ month</span>
            </div>
            <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 32px" }}>For families just getting started.</p>
            <Link href="/sign-up" style={{ display: "block", textAlign: "center", backgroundColor: "#1B3A5C", color: "#fff", padding: "12px 24px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none", marginBottom: "32px" }}>Get started free</Link>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {FREE_FEATURES.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Check size={16} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span style={{ fontSize: "14px", color: "#444" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div style={{ border: "2px solid #C4664A", borderRadius: "20px", padding: "40px", position: "relative", backgroundColor: "#FDFAF9" }}>
            <div style={{ position: "absolute", top: "20px", right: "20px", backgroundColor: "#C4664A", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Most popular</div>
            <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4664A", margin: "0 0 16px" }}>Pro</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "48px", fontWeight: 700, color: "#1B3A5C" }}>$7.99</span>
              <span style={{ fontSize: "14px", color: "#717171" }}>/ month</span>
            </div>
            <p style={{ fontSize: "14px", color: "#717171", margin: "0 0 32px" }}>Or $59.99 / year &mdash; save 37%.</p>
            <Link href="/sign-up" style={{ display: "block", textAlign: "center", backgroundColor: "#C4664A", color: "#fff", padding: "12px 24px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none", marginBottom: "32px" }}>Start Pro free for 14 days</Link>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {PRO_FEATURES.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Check size={16} style={{ color: "#C4664A", flexShrink: 0 }} />
                  <span style={{ fontSize: "14px", color: "#444" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>Frequently asked questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ backgroundColor: "#fff", borderRadius: "12px", overflow: "hidden", border: "1px solid #F0F0F0" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", textAlign: "left", padding: "20px 24px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "#1B3A5C" }}>{faq.q}</span>
                  <span style={{ fontSize: "20px", color: "#C4664A", fontWeight: 400, lineHeight: 1 }}>{openFaq === i ? "\u2212" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 20px" }}>
                    <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
