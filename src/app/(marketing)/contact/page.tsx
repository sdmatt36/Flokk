"use client";

import { useState } from "react";
import { Mail, MapPin, Clock } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: "15px",
  border: "1.5px solid #E0E0E0",
  borderRadius: "10px",
  outline: "none",
  color: "#1a1a1a",
  backgroundColor: "#FAFAFA",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>Contact</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            We&apos;d love to hear from you.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.6 }}>
            We&apos;re a small team. We read every message and respond within 24 hours on weekdays.
          </p>
        </div>
      </section>

      {/* Two-column layout */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "80px", alignItems: "flex-start" }}>
          {/* Contact info */}
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 32px" }}>Get in touch</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(27,58,92,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Mail size={18} style={{ color: "#1B3A5C" }} />
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Email</p>
                  <p style={{ fontSize: "15px", color: "#717171", margin: 0 }}>hello@flokktravel.com</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(27,58,92,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MapPin size={18} style={{ color: "#1B3A5C" }} />
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Location</p>
                  <p style={{ fontSize: "15px", color: "#717171", margin: 0 }}>Kamakura, Japan</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "rgba(27,58,92,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Clock size={18} style={{ color: "#1B3A5C" }} />
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Response time</p>
                  <p style={{ fontSize: "15px", color: "#717171", margin: 0 }}>Within 24 hours on weekdays (JST)</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "48px", padding: "28px", backgroundColor: "rgba(27,58,92,0.04)", borderRadius: "16px" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 8px" }}>Press inquiries</p>
              <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>For press and media, email press@flokktravel.com. We respond to media inquiries same day when possible.</p>
            </div>
          </div>

          {/* Form */}
          <div>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "64px 0" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "rgba(196,102,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <span style={{ fontSize: "28px", color: "#C4664A" }}>&#10003;</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>Message sent</h2>
                <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.6 }}>Thanks for reaching out. We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "#555" }}>Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "#555" }}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#555" }}>Subject</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="How can we help?" style={inputStyle} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#555" }}>Message</label>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} placeholder="Tell us more..." style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <button
                  type="submit"
                  style={{ padding: "14px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px", border: "none", borderRadius: "12px", cursor: "pointer" }}
                >
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
