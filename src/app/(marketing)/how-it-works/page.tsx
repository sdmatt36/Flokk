import Link from "next/link";
import { MapPin } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>How it works</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "#fff", maxWidth: "760px", margin: "0 auto 24px", lineHeight: 1.2 }}>
            Trip planning is a second job.<br />We're here to fire you from it.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            The 10+ hours buried in Instagram saves, fighting tab-creep, and losing recommendations in group chats. We built Flokk to end that.
          </p>
        </div>
      </section>

      {/* Step 1 — white, content left, visual right */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", display: "block", marginBottom: "12px" }}>Step 1</span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Save anything, from anywhere</h2>
            <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7 }}>
              See something on Instagram? A restaurant your friend mentioned? A hotel in a TikTok reel? Share it to Flokk the same way you'd share it to a text message. We pull the location, category, and context automatically.
            </p>
          </div>
          <div style={{ backgroundColor: "#F9F9F9", borderRadius: "20px", padding: "40px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {["Instagram reel \u2192 saved", "TikTok restaurant \u2192 saved", "Google Maps pin \u2192 saved", "Any URL \u2192 saved"].map((item) => (
              <div key={item} style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "14px 18px", fontSize: "14px", color: "#1B3A5C", fontWeight: 500, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step 2 — light tint, visual left, content right */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "32px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0", maxWidth: "400px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <MapPin size={16} style={{ color: "#C4664A" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A" }}>400m from your hotel</span>
            </div>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 8px" }}>Le Comptoir du Relais · Paris</p>
            <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.6, margin: "0 0 16px" }}>
              Saved 6 months ago from Instagram. Your kids love pasta. It has a kids menu. Want to add it to Tuesday?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "8px 16px", backgroundColor: "#C4664A", color: "#fff", border: "none", borderRadius: "20px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Add to Tuesday</button>
              <button style={{ padding: "8px 16px", backgroundColor: "#fff", color: "#1B3A5C", border: "1.5px solid #E0E0E0", borderRadius: "20px", fontSize: "13px", cursor: "pointer" }}>View on map</button>
            </div>
          </div>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", display: "block", marginBottom: "12px" }}>Step 2</span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>We surface the right saves at the right moment</h2>
            <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7 }}>
              When you start planning a trip to Paris, Flokk knows you saved that bistro six months ago. It's 400m from your hotel. Your kids love pasta. It connects the dots so you don't have to.
            </p>
          </div>
        </div>
      </section>

      {/* Step 3 — white, content left, visual right */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", display: "block", marginBottom: "12px" }}>Step 3</span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Build a trip that actually works for your family</h2>
            <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7 }}>
              Drag saves and recommendations into a day-by-day itinerary. Proximity warnings, time estimates, and smart suggestions based on what families like yours loved. Export to Apple Maps or Google Maps with one tap.
            </p>
          </div>
          <div style={{ backgroundColor: "#F9F9F9", borderRadius: "20px", padding: "32px" }}>
            {["Day 1 \u00b7 Arrive & settle", "Day 2 \u00b7 Museums + pasta lunch", "Day 3 \u00b7 Day trip to Versailles", "Day 4 \u00b7 Markets + departure"].map((day, i) => (
              <div key={i} style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "14px 18px", fontSize: "14px", color: "#1B3A5C", fontWeight: 500, marginBottom: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {day}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step 4 — light tint, visual left, content right */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          {/* Stacked community trip cards */}
          <div style={{ position: "relative", maxWidth: "380px", height: "200px" }}>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0", position: "absolute", top: "16px", left: "16px", right: "16px", opacity: 0.6, transform: "rotate(-2deg)" }}>
              <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "14px", margin: "0 0 4px" }}>Kyoto with Kids</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>6 days · Family of 4</p>
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0", position: "absolute", top: "8px", left: "8px", right: "8px", opacity: 0.8, transform: "rotate(1deg)" }}>
              <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "14px", margin: "0 0 4px" }}>Madrid Long Weekend</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>4 days · Kids 7 & 10</p>
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", border: "1px solid #F0F0F0", position: "relative", zIndex: 10 }}>
              <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "14px", margin: "0 0 4px" }}>Okinawa May '25</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: "0 0 12px" }}>5 days · Beach + Culture</p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ fontSize: "12px", padding: "6px 12px", backgroundColor: "#C4664A", color: "#fff", borderRadius: "999px", border: "none", fontWeight: 600, cursor: "pointer" }}>Add to my trips</button>
                <button style={{ fontSize: "12px", padding: "6px 12px", border: "1.5px solid #E0E0E0", color: "#1B3A5C", borderRadius: "999px", backgroundColor: "#fff", cursor: "pointer" }}>Preview</button>
              </div>
            </div>
          </div>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", display: "block", marginBottom: "12px" }}>Step 4</span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>Steal someone else's itinerary</h2>
            <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.7 }}>
              Browse real trip itineraries from families with kids the same ages and interests as yours. Found one you love? Add it to your trips with one tap and make it your own.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "40px", fontWeight: 600, color: "#fff", margin: "0 0 16px" }}>Ready to end the chaos?</h2>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", margin: "0 0 32px" }}>Join families who plan smarter with Flokk.</p>
          <Link href="/sign-up" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "16px", fontWeight: 700, textDecoration: "none" }}>Get started free →</Link>
        </div>
      </section>
    </div>
  );
}
