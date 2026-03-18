"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = ["All", "Product", "Travel", "Family", "Tips"];

interface BlogPost {
  category: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  hero: boolean;
  imageUrl?: string;
}

const CATEGORY_BG: Record<string, string> = {
  Product: "rgba(196,102,74,0.08)",
  Travel: "rgba(14,165,233,0.08)",
  Tips: "rgba(245,158,11,0.08)",
  Family: "rgba(34,197,94,0.08)",
};

const CATEGORY_TEXT: Record<string, string> = {
  Product: "#C4664A",
  Travel: "#0284c7",
  Tips: "#d97706",
  Family: "#15803d",
};

const POSTS: BlogPost[] = [
  {
    category: "Product",
    title: "Why we built Flokk instead of using a spreadsheet",
    excerpt: "Every family has a system. Ours was a shared note with 200 unorganized links. Here's why that stopped working.",
    date: "March 2026",
    readTime: "5 min read",
    hero: true,
  },
  {
    category: "Travel",
    title: "Planning a week in Japan with two kids under 10",
    excerpt: "Bullet trains, ramen, and nap schedules. What actually worked for our family trip to Tokyo and Kyoto.",
    date: "February 2026",
    readTime: "8 min read",
    hero: false,
  },
  {
    category: "Tips",
    title: "The 15-minute trip planning habit that saves hours later",
    excerpt: "One small habit — saving links as you find them, not when you need them — changes everything about how you plan.",
    date: "February 2026",
    readTime: "4 min read",
    hero: false,
  },
  {
    category: "Family",
    title: "How to get kids excited about a trip before you leave",
    excerpt: "Building anticipation is half the value of a family trip. These are the tools and tricks that work for us.",
    date: "January 2026",
    readTime: "6 min read",
    hero: false,
  },
  {
    category: "Product",
    title: "What happens when you share a TikTok into Flokk",
    excerpt: "A look under the hood at how we extract useful data from social media links so you don't have to.",
    date: "January 2026",
    readTime: "3 min read",
    hero: false,
  },
];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = POSTS.filter((p) => activeCategory === "All" || p.category === activeCategory);

  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Blog</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", margin: "0 auto 24px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
            Travel better. Plan smarter.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            Guides, product updates, and stories from the Flokk team.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <section style={{ backgroundColor: "#fff", borderBottom: "1px solid #EEEEEE", padding: "0 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", gap: "4px", padding: "16px 0" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: "999px",
                fontSize: "14px",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                backgroundColor: activeCategory === cat ? "#1B3A5C" : "transparent",
                color: activeCategory === cat ? "#fff" : "#717171",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Posts */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          {/* Hero post */}
          {filtered[0] && (
            <div style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "20px", padding: "48px", marginBottom: "48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "#C4664A", color: "#fff", padding: "3px 10px", borderRadius: "999px" }}>{filtered[0].category}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(27,58,92,0.12)", color: "#1B3A5C", padding: "3px 10px", borderRadius: "999px" }}>Coming soon</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px", lineHeight: 1.3 }}>{filtered[0].title}</h2>
                <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7, margin: "0 0 20px" }}>{filtered[0].excerpt}</p>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#999" }}>{filtered[0].date}</span>
                  <span style={{ fontSize: "13px", color: "#999" }}>&bull;</span>
                  <span style={{ fontSize: "13px", color: "#999" }}>{filtered[0].readTime}</span>
                </div>
              </div>
              <div style={{ backgroundColor: CATEGORY_BG[filtered[0].category] ?? "rgba(27,58,92,0.06)", borderRadius: "16px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: CATEGORY_TEXT[filtered[0].category] ?? "#717171", opacity: 0.6 }}>{filtered[0].category}</span>
              </div>
            </div>
          )}

          {/* Post grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {filtered.slice(1).map((post) => (
              <div key={post.title} style={{ border: "1px solid #F0F0F0", borderRadius: "16px", overflow: "hidden" }}>
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.imageUrl} alt={post.title} style={{ width: "100%", height: "160px", objectFit: "cover" }} />
                ) : (
                  <div style={{ backgroundColor: CATEGORY_BG[post.category] ?? "rgba(27,58,92,0.06)", height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: CATEGORY_TEXT[post.category] ?? "#717171", opacity: 0.6 }}>{post.category}</span>
                  </div>
                )}
                <div style={{ padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(27,58,92,0.08)", color: "#1B3A5C", padding: "3px 8px", borderRadius: "999px" }}>{post.category}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", backgroundColor: "#F5F5F5", color: "#999", padding: "3px 8px", borderRadius: "999px" }}>Coming soon</span>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 10px", lineHeight: 1.3 }}>{post.title}</h3>
                  <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: "0 0 16px" }}>{post.excerpt}</p>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#999" }}>{post.date}</span>
                    <span style={{ fontSize: "12px", color: "#999" }}>&bull;</span>
                    <span style={{ fontSize: "12px", color: "#999" }}>{post.readTime}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
