"use client";

import Link from "next/link";
import { useState } from "react";

const MORE_FEATURES = [
  {
    title: "Email Intelligence",
    teaser: "Forward to trips@flokktravel.com.",
    description: "Forward any booking confirmation, restaurant recommendation, or travel link to trips@flokktravel.com. Flokk parses it, extracts the details, and files it in the right trip automatically.",
  },
  {
    title: "Voice notes to itinerary",
    teaser: "Coming soon.",
    description: "Dictate your travel ideas and Flokk turns them into structured itinerary items. No typing required.",
  },
  {
    title: "iOS share sheet",
    teaser: "Coming soon.",
    description: "Save from any iOS app — Instagram, Safari, Maps — with a single tap from the native share sheet.",
  },
  {
    title: "Booking Portal",
    teaser: "Book flights, hotels, and rental cars — coming soon.",
    description: "Book directly on Flokk and your confirmation files automatically into your trip. No forwarding emails.",
  },
  {
    title: "Flokker Profiles",
    teaser: "Follow families with similar taste.",
    description: "Follow other Flokk families whose travel style matches yours. See what they rated, what they skipped, and what trips they've shared.",
  },
  {
    title: "Best Of rankings",
    teaser: "The list that actually matters.",
    description: "Destination-specific Best Of rankings built from real family ratings — not sponsored content or review farms.",
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

      {/* Section 1 — Save Anywhere */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Save</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Save anywhere</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              Rescue your saved content from Instagram, TikTok, Google Maps, and anywhere else — and make it actually useful.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Save from any social platform", desc: "Share directly from Instagram, TikTok, YouTube, or any website. Flokk extracts the name, location, photo, and category automatically — no manual entry." },
              { title: "Forward to trips@flokktravel.com", desc: "Email any link, recommendation, or booking confirmation to trips@flokktravel.com. Flokk reads it, identifies the place or booking, and adds it to the right trip." },
              { title: "Booking confirmations auto-file", desc: "Forward your hotel, flight, or activity confirmations. Flokk parses the details and adds them to your itinerary with check-in dates, confirmation codes, and costs." },
              { title: "Auto-enrichment", desc: "Every save is automatically matched against Google Places to pull in the official name, city, photo, and website — even when the original source had none of that." },
              { title: "Duplicate detection", desc: "Saved the same place twice from different sources? Flokk catches it and merges rather than cluttering your library with duplicates." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — Plan Effortlessly */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Plan</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Plan effortlessly</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              Build your family's itinerary without the spreadsheet.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Day planner with map pins", desc: "Drag your saves into a day-by-day schedule. Each item pins to the map so you can see whether your plan actually makes geographic sense." },
              { title: "Flight and hotel auto-import", desc: "Forward your booking confirmation emails and Flokk adds flights, check-ins, and check-outs to your itinerary automatically — with dates, times, and confirmation codes." },
              { title: "Packing lists", desc: "Generate a packing list tailored to your destination, the season, your trip duration, and your family's ages. Check items off as you pack." },
              { title: "Budget tracking", desc: "Costs from booking confirmations are captured automatically. Add manual entries for cash spending. Flokk tracks total spend against your budget in real time." },
              { title: "Trip Readiness score", desc: "A live score that tells you how complete your trip plan is — missing confirmations, unbookable saves, and planning gaps surfaced before it's too late." },
              { title: "Auto-sort by time", desc: "Add items without worrying about order. Flokk sorts flights, check-ins, activities, and check-outs by time and type so your itinerary always reads correctly." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — Discover What Families Love */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Discover</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Discover what families love</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              Real recommendations from real families — not SEO listicles.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Community Picks", desc: "Places rated by families who have actually been there. Filtered by destination, category, and the ages of kids in the group — not generic star ratings." },
              { title: "Flokk Travel Intel guides", desc: "Curated destination guides written for families: what to skip, what to book early, what to save for a rainy day. Updated from the community, not a content team." },
              { title: "Steal This Itinerary", desc: "Browse real trips shared by other Flokk families. Copy the whole plan, or cherry-pick the saves you want. The fastest way to plan a trip you've never done before." },
              { title: "Destination search", desc: "Search any destination and surface saves from across the Flokk community. Weighted by family ratings, recency, and relevance to your travel style." },
              { title: "Filter by category, age, and style", desc: "Every discovery tool in Flokk knows your kids' ages and your family's interests. Filters aren't bolted on — they're built into the ranking from the start." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Built for Your Family */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "8px" }}>Personalize</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Built for your family</h2>
            <p style={{ fontSize: "16px", color: "#717171", maxWidth: "560px", lineHeight: 1.7 }}>
              Flokk learns what your family loves and gets smarter with every trip.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Family profile", desc: "Set traveler ages, dietary preferences, and travel interests once. Every recommendation, filter, and planning suggestion is shaped by this profile from day one." },
              { title: "AI Trip Intelligence", desc: "Flokk scans your itinerary for conflicts, booking urgency, and gaps — then surfaces alerts before they become problems. Like a travel agent who's read your whole plan." },
              { title: "Post-trip ratings", desc: "After each trip, rate the places you visited. Your ratings improve recommendations for your own future trips and feed the community engine for families like yours." },
              { title: "Shareable trip pages", desc: "Every trip gets a shareable link with privacy controls. Share a read-only view with family members, or make it public so other Flokk families can discover your itinerary." },
              { title: "Co-owner invite", desc: "Invite a partner or co-planner to your trip with full edit access. Plan together in real time without emailing spreadsheets back and forth." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
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
