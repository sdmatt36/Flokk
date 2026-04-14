"use client";

import Link from "next/link";
import { useState } from "react";
import { POSTS } from "./posts";

const CATEGORIES = ["All", "Product", "Travel", "Family", "Tips"];


export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = POSTS.filter(
    (p) => activeCategory === "All" || p.category === activeCategory.toUpperCase()
  );

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
            <Link href={`/blog/${filtered[0].slug}`} style={{ textDecoration: "none" }}>
              <div style={{ backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "20px", padding: "48px", marginBottom: "48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "#C4664A", color: "#fff", padding: "3px 10px", borderRadius: "999px" }}>{filtered[0].category}</span>
                  </div>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px", lineHeight: 1.3 }}>{filtered[0].title}</h2>
                  <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7, margin: "0 0 20px" }}>{filtered[0].excerpt}</p>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "#999" }}>{filtered[0].date}</span>
                    <span style={{ fontSize: "13px", color: "#999" }}>&bull;</span>
                    <span style={{ fontSize: "13px", color: "#999" }}>{filtered[0].readTime}</span>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filtered[0].heroImage} alt={filtered[0].title} style={{ borderRadius: "16px", height: "240px", width: "100%", objectFit: "cover" }} />
              </div>
            </Link>
          )}

          {/* Post grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {filtered.slice(1).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
                <div style={{ border: "1px solid #F0F0F0", borderRadius: "16px", overflow: "hidden", height: "100%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.heroImage} alt={post.title} style={{ width: "100%", height: "160px", objectFit: "cover" }} />
                  <div style={{ padding: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(27,58,92,0.08)", color: "#1B3A5C", padding: "3px 8px", borderRadius: "999px" }}>{post.category}</span>
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
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
