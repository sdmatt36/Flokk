import Link from "next/link";
import { Bookmark, Map, Users, Zap, Bell, Share2 } from "lucide-react";

const FEATURES = [
  {
    icon: Bookmark,
    title: "Universal save",
    description: "Share any URL into Flokk from any app. Instagram, TikTok, Google Maps, or any website. We extract the name, location, and category automatically.",
  },
  {
    icon: Map,
    title: "Smart trip matching",
    description: "When you plan a trip, Flokk surfaces saves that are near your destination and relevant to your family. No searching, no scrolling.",
  },
  {
    icon: Users,
    title: "Family profiles",
    description: "Tell us about your travel group once. Ages, interests, dietary needs. We factor it in every time we make a recommendation.",
  },
  {
    icon: Zap,
    title: "AI itinerary builder",
    description: "Drag your saves into a day-by-day plan. Flokk checks proximity, opening hours, and realistic timing so the schedule actually holds.",
  },
  {
    icon: Bell,
    title: "Trip reminders",
    description: "As your trip approaches, we resurface the saves you almost forgot and remind you to book ahead for popular spots.",
  },
  {
    icon: Share2,
    title: "One-tap export",
    description: "Export your full itinerary to Apple Maps or Google Maps with a single tap. No copy-pasting addresses.",
  },
];

export default function FeaturesPage() {
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
              { title: "Share-sheet integration", desc: "Works from every app on your phone. Share to Flokk the same way you'd share to WhatsApp." },
              { title: "Auto-extraction", desc: "We pull the venue name, address, cuisine type, price range, and any notes from the source automatically." },
              { title: "Smart categories", desc: "Restaurants, hotels, activities, sights. Every save is auto-tagged so your library stays organized." },
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {[
              { title: "Proximity-aware scheduling", desc: "We know where your hotel is. We group nearby saves and warn you when a plan has too much travel between stops." },
              { title: "Day-by-day view", desc: "Drag saves into morning, afternoon, and evening slots. See the full shape of each day at a glance." },
              { title: "Export to maps", desc: "One tap sends your full itinerary to Apple Maps or Google Maps, ready to navigate." },
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
              { title: "Family profiles", desc: "Add travelers once. Ages, interests, dietary needs, and accessibility requirements are factored into every suggestion." },
              { title: "Interest matching", desc: "Into street food, museums, hiking? We weight recommendations to match what your family actually enjoys." },
              { title: "Trip history", desc: "Past trips inform future ones. We know where you've been and won't keep suggesting the same places." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "28px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C", margin: "0 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", color: "#717171", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature card grid */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#fff", margin: "0 0 48px", textAlign: "center" }}>And a lot more</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "16px", padding: "28px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ marginBottom: "16px" }}>
                    <Icon size={20} style={{ color: "#C4664A" }} />
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>{feature.title}</h3>
                  <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>{feature.description}</p>
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
