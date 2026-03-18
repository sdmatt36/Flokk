"use client";

import Link from "next/link";
import { useState } from "react";

const MORE_FEATURES = [
  {
    title: "Universal save",
    teaser: "Share from any app.",
    description: "Share any URL into Flokk from any app. Instagram, TikTok, Google Maps, or any website. We extract the name, location, and category automatically.",
  },
  {
    title: "Smart trip matching",
    teaser: "Your saves, surfaced at the right moment.",
    description: "When you plan a trip, Flokk surfaces saves that are near your destination and relevant to your family. No searching, no scrolling.",
  },
  {
    title: "Family profiles",
    teaser: "Set it once. Use it everywhere.",
    description: "Tell us about your travel group once. Ages, interests, dietary needs. We factor it in every time we make a recommendation.",
  },
  {
    title: "AI itinerary builder",
    teaser: "A real schedule in minutes.",
    description: "Drag your saves into a day-by-day plan. Flokk checks proximity, opening hours, and realistic timing so the schedule actually holds.",
  },
  {
    title: "Trip reminders",
    teaser: "Nothing falls through the cracks.",
    description: "As your trip approaches, we resurface the saves you almost forgot and remind you to book ahead for popular spots.",
  },
  {
    title: "One-tap export",
    teaser: "Your plan, in Apple Maps or Google Maps.",
    description: "Export your full itinerary to Apple Maps or Google Maps with a single tap. No copy-pasting addresses.",
  },
];

export default function FeaturesPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Features</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "760px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Everything you need. Nothing you don't.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            Flokk is built around one idea: saving a place should mean you actually get to go there. Every feature exists to close that gap.
          </p>
        </div>
      </section>

      {/* Save section */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Save</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Capture everything that inspires you</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              No more screenshots you'll never find again. No more texting yourself links. Flokk is the one place where inspiration becomes a plan.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Save from anywhere", desc: "Whether it's an Instagram reel, a TikTok, a Google Maps pin, or a link someone sent in a group chat — share it to Flokk and it lands in your library, organized and ready to use." },
              { title: "Personal travel library", desc: "Every place you've ever saved, in one searchable place. Filter by destination, category, or trip. Never lose a recommendation again." },
              { title: "Smart tagging", desc: "We read the source, infer the category, and tag it automatically. Restaurants, hotels, activities, and sights are sorted before you even open the app." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plan section */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Plan</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Turn saves into a real itinerary</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              A trip plan that fits your days, your hotel location, and your group. Built in minutes, not hours.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
            {[
              { title: "Trip builder", desc: "Drag your saves into a day-by-day itinerary. Set your hotel, your dates, and let Flokk build a logical schedule around what you've already found." },
              { title: "Recommendations for your family", desc: "Flokk knows what worked for families like yours in the same destination. It fills in the gaps in your itinerary with places that actually fit." },
              { title: "Proximity awareness", desc: "We know where your hotel is. Saves get clustered by location so each day minimizes transit and maximizes time." },
              { title: "Itinerary export", desc: "Send the full plan to Apple Maps or Google Maps in one tap. Day-by-day directions, no manual entry." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personalize section */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Personalize</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Built around your family, not a generic traveler</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              Flokk knows your kids' ages, your dietary preferences, and what you care about most when you travel. That context shapes every recommendation.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Family profiles", desc: "Add the people traveling with you — ages, interests, dietary needs. Flokk uses this to filter and rank every recommendation, every time." },
              { title: "Behavioral learning", desc: "The more you use Flokk, the better it gets. It learns from which saves you keep, which you drop, and how your family actually travels." },
              { title: "Community intelligence", desc: "Recommendations aren't just algorithmic. They're informed by what real families with similar kids and interests found worth doing." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* And a lot more — expandable cards */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#fff", margin: "0 0 48px", textAlign: "center" }}>And a lot more</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {MORE_FEATURES.map((feature) => {
              const isOpen = expandedCard === feature.title;
              return (
                <div
                  key={feature.title}
                  onClick={() => setExpandedCard(isOpen ? null : feature.title)}
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "background 0.15s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{feature.title}</h3>
                      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>{feature.teaser}</p>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, fontSize: "16px", lineHeight: 1, transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: "0 0 16px" }}>{feature.description}</p>
                      <Link
                        href="/sign-up"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}
                      >
                        Try it in the app &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <Link href="/sign-up" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Start for free &rarr;</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
