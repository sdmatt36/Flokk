import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>How it works</p>
          <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl md:text-5xl font-semibold text-white max-w-2xl mx-auto leading-tight text-center" style={{ marginBottom: "24px" }}>
            Trip planning is a second job. We're here to fire you from it.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            The 20+ hours buried in Instagram saves, fighting tab-creep, and losing recommendations in group chats. We built Flokk to end that.
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
          {/* Share-sheet panel */}
          <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", border: "1px solid #E8E8E8" }}>
            <div style={{ backgroundColor: "#1B3A5C", padding: "16px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Share to Flokk</span>
            </div>
            {[
              { source: "IG", label: "Trattoria da Enzo al 29 · Rome", type: "Restaurant" },
              { source: "TK", label: "Hotel Costes · Paris", type: "Hotel" },
              { source: "GM", label: "Nishiki Market · Kyoto", type: "Market" },
              { source: "↗", label: "Things to do in Lisbon with kids", type: "Article" },
            ].map((row) => (
              <div key={row.label} style={{ backgroundColor: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F5F5F5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(27,58,92,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#1B3A5C", flexShrink: 0 }}>{row.source}</div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 2px" }}>{row.label}</p>
                    <p style={{ fontSize: "11px", color: "#717171", margin: 0 }}>{row.type}</p>
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", backgroundColor: "#C4664A", padding: "3px 10px", borderRadius: "999px", flexShrink: 0, marginLeft: "12px" }}>Saved</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step 2 — light tint, visual left, content right */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          {/* Magic moment card with pulsing location dot */}
          <div style={{ position: "relative", maxWidth: "400px" }}>
            <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px" }}>
              <span className="animate-ping" style={{ position: "absolute", width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(196,102,74,0.35)", display: "block" }} />
              <span style={{ position: "relative", width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "#C4664A", display: "block", boxShadow: "0 0 0 3px #fff" }} />
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: "20px", padding: "32px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #F0F0F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
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
          {/* Itinerary UI panel */}
          <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #EEEEEE" }}>
            <div style={{ backgroundColor: "#1B3A5C", padding: "20px 24px" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Paris · 4 days</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", margin: 0 }}>June 14 – 18 · Family of 4</p>
            </div>
            {[
              { day: "Day 1", label: "Arrive & settle", items: ["Check into hotel · Marais", "Dinner: Bistrot Paul Bert"] },
              { day: "Day 2", label: "Museums + pasta lunch", items: ["Musée d'Orsay · 10am", "Le Comptoir du Relais · 1pm", "Tuileries Garden"] },
              { day: "Day 3", label: "Day trip to Versailles", items: ["Château de Versailles · 9am", "Palace gardens walk"] },
              { day: "Day 4", label: "Markets + departure", items: ["Marché Bastille · 8am", "Charles de Gaulle · 3pm"] },
            ].map((d, i) => (
              <div key={d.day} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#FAFAFA", padding: "16px 24px", borderBottom: "1px solid #F0F0F0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4664A" }}>{d.day}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#1B3A5C" }}>{d.label}</span>
                </div>
                {d.items.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#C4664A", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#717171" }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step 4 — light tint, visual left, content right */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          {/* Stacked community trip cards */}
          <div style={{ position: "relative", maxWidth: "380px" }}>
            {/* Back card — Kyoto, rotated left, peeks from behind */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1px solid #EBEBEB", opacity: 0.45, transform: "rotate(-3deg) translate(-6px, 8px)" }}>
              <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "14px", margin: "0 0 4px" }}>Kyoto with Kids</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>6 days · Family of 4</p>
            </div>
            {/* Middle card — Madrid, rotated right, peeks from behind */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", border: "1px solid #EBEBEB", opacity: 0.7, transform: "rotate(2.5deg) translate(6px, 4px)" }}>
              <p style={{ fontWeight: 600, color: "#1B3A5C", fontSize: "14px", margin: "0 0 4px" }}>Madrid Long Weekend</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>4 days · Kids 7 & 10</p>
            </div>
            {/* Front card — Okinawa, in normal flow, determines container height */}
            <div style={{ position: "relative", zIndex: 10, backgroundColor: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #F0F0F0" }}>
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
