"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = [
  {
    title: "Saving content",
    articles: [
      "How to save a link from Instagram",
      "Saving from TikTok",
      "Using the iOS share sheet",
      "What happens to a link when you save it",
    ],
  },
  {
    title: "Planning trips",
    articles: [
      "Creating your first trip",
      "Adding saves to a trip",
      "Understanding the itinerary view",
      "Exporting to Apple Maps or Google Maps",
    ],
  },
  {
    title: "Family profiles",
    articles: [
      "Setting up your family profile",
      "Adding travelers",
      "How interests affect recommendations",
      "Editing dietary preferences",
    ],
  },
  {
    title: "Account & settings",
    articles: [
      "Updating your email or password",
      "Notification preferences",
      "Deleting your account",
      "Exporting your data",
    ],
  },
  {
    title: "Billing",
    articles: [
      "How the free tier works",
      "Upgrading to Pro",
      "Canceling your subscription",
      "Getting a refund",
    ],
  },
  {
    title: "Troubleshooting",
    articles: [
      "A link didn't save correctly",
      "The app isn't loading",
      "My saves disappeared",
      "Reporting a bug",
    ],
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState("");

  return (
    <div>
      {/* Hero with search */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Help center</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 32px", lineHeight: 1.2 }}>
            How can we help?
          </h1>
          <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              style={{
                width: "100%",
                padding: "16px 24px",
                fontSize: "16px",
                border: "none",
                borderRadius: "999px",
                outline: "none",
                color: "#1a1a1a",
                backgroundColor: "#fff",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
      </section>

      {/* Category cards */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {CATEGORIES.map((cat) => {
              return (
                <div key={cat.title} style={{ border: "1px solid #F0F0F0", borderRadius: "16px", padding: "28px" }}>
                  <div style={{ marginBottom: "20px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: 0 }}>{cat.title}</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cat.articles.map((article) => (
                      <a
                        key={article}
                        href={`/contact?subject=${encodeURIComponent(article)}`}
                        className="text-sm text-[#717171] hover:text-[#C4664A] transition-colors cursor-pointer block py-1"
                        style={{ textDecoration: "none", borderBottom: "1px solid #F8F8F8" }}
                      >
                        {article}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-12 py-8 border-t border-gray-100">
            <p className="text-[#717171] text-sm">Can't find what you're looking for?</p>
            <a href="/contact" className="text-[#C4664A] text-sm font-medium hover:underline mt-1 inline-block">
              Ask us directly — we respond within 24 hours →
            </a>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Still need help?</h2>
          <p style={{ fontSize: "16px", color: "#717171", margin: "0 0 28px" }}>We're a small team and we read every message. Get in touch and we'll get back to you within 24 hours.</p>
          <Link href="/contact" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "12px 28px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>Contact us &rarr;</Link>
        </div>
      </section>
    </div>
  );
}
