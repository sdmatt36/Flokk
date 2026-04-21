import Link from "next/link";
import { Show, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Playfair_Display } from "next/font/google";
import { SiteFooter } from "@/components/ui/SiteFooter";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/home");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF", overflowX: "hidden", maxWidth: "100vw" }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b" style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: "#EEEEEE" }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold" style={{ color: "#2d2d2d" }}>
            Flokk
          </span>
          <div className="flex items-center gap-4">
            <Show when="signed-out">
              <SignInButton>
                <button className="text-sm font-medium transition-colors" style={{ color: "#717171" }}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="text-sm font-semibold px-5 py-2.5 rounded-full transition-colors text-white" style={{ backgroundColor: "#C4664A" }}>
                  Get early access
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/home" className="text-sm font-medium transition-colors" style={{ color: "#717171" }}>
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: "9rem", paddingBottom: "5rem", paddingLeft: "1.5rem", paddingRight: "1.5rem", backgroundColor: "#FFFFFF" }}>

        {/* Background photo — desktop only */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1800&q=80"
          alt=""
          aria-hidden="true"
          className="hidden md:block"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: 0, pointerEvents: "none" }}
        />

        {/* Gradient overlay — desktop only, strictly scoped to this section */}
        <div
          className="hidden md:block"
          style={{
            position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
            background: "linear-gradient(to right, rgba(255,255,255,0.85) 40%, rgba(255,255,255,0.3) 100%)"
          }}
        />

        {/* Hero content — above image and overlay */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-[1fr_360px] gap-10 items-center">

              {/* Left: hero text */}
              <div className="text-center md:text-left space-y-7 pb-8">
                <div className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-1.5 rounded-full" style={{ backgroundColor: "#6B8F71", color: "#fff" }}>
                  Now in early access
                </div>
                <h1 className="text-5xl md:text-6xl font-bold leading-tight" style={{ color: "#1a1a1a" }}>
                  Your family&apos;s next great trip —{" "}
                  <span style={{ color: "#C4664A" }}>finally in one place.</span>
                </h1>
                <p className="text-lg font-medium italic" style={{ color: "#C4664A", marginTop: "16px", marginBottom: "8px" }}>
                  Save it, plan it, book it, share it.
                </p>
                <p className="text-xl leading-relaxed" style={{ color: "#717171" }}>
                  The restaurants you saved on Instagram. The hotel from that email thread. The budget in a spreadsheet nobody&apos;s updated. The itinerary lost in WhatsApp. Flokk brings it all together — and connects you to real trips from families who&apos;ve already been there.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start pt-2">
                  <Link
                    href="/sign-up"
                    className="font-semibold px-8 py-4 rounded-full text-base transition-colors text-white shadow-sm"
                    style={{ backgroundColor: "#C4664A" }}
                  >
                    Get early access — it&apos;s free →
                  </Link>
                  <a
                    href="#how-it-works"
                    className="font-semibold px-8 py-4 rounded-full text-base transition-colors border"
                    style={{ color: "#2d2d2d", borderColor: "#EEEEEE", backgroundColor: "transparent" }}
                  >
                    See how it works
                  </a>
                </div>
                <p className="text-sm" style={{ color: "#999" }}>No credit card required. · Join 200+ families already planning smarter.</p>
              </div>

              {/* Right: floating product card — desktop only */}
              <div className="hidden md:block" style={{ transform: "rotate(2.5deg)", filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.14))" }}>
                <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: "#fff", borderColor: "#EEEEEE", maxWidth: "320px" }}>
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <span className="text-xs font-medium" style={{ color: "#999" }}>600m from your hotel</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=640&q=80" alt="Mercado de San Miguel" className="w-full object-cover" style={{ height: "160px" }} />
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>Mercado de San Miguel</p>
                      <p className="text-xs mt-0.5" style={{ color: "#999" }}>Madrid · Saved 4 months ago from Instagram</p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#717171" }}>
                      Opens at 10am — perfect before your museum visit. Kids aged 6+ love the churros counter.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button className="flex-1 text-sm font-semibold py-2 rounded-xl text-white" style={{ backgroundColor: "#1a1a1a" }}>
                        Add to Tuesday
                      </button>
                      <button className="px-4 text-sm font-medium rounded-xl border" style={{ borderColor: "#EEEEEE", color: "#717171" }}>
                        Map
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* From the community strip — separate section, no overlap with hero */}
      <section style={{ backgroundColor: "#FAFAFA", paddingTop: "5rem", paddingBottom: "5rem", paddingLeft: "1.5rem", paddingRight: "1.5rem", position: "relative", zIndex: 0 }}>
        <p className="text-center text-sm font-semibold tracking-widest uppercase mb-6" style={{ color: "#717171" }}>From the community</p>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { img: "https://images.unsplash.com/photo-1560703649-e3055f28bcf8?w=600&q=80", label: "Saved from Instagram", sub: "Santorini · Bucket list", objPos: "center 65%" },
            { img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", label: "Tokyo with Kids", sub: "Itinerary · 8 days", objPos: "center center" },
            { img: "https://images.unsplash.com/photo-1662624477903-7962aa7ff4ae?w=600&q=80", label: "Villa Rental · Tuscany", sub: "Summer 2026 · Shortlist", objPos: "center 60%" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl overflow-hidden shadow-sm border" style={{ backgroundColor: "#fff", borderColor: "#EEEEEE" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.img} alt={card.label} className="w-full h-36 object-cover" style={{ objectPosition: card.objPos ?? "center center" }} />
              <div className="p-4">
                <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{card.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "#999" }}>{card.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* See it in action */}
      <section id="how-it-works" className="px-5 py-10 md:px-12 md:py-[60px]" style={{ backgroundColor: "#FAFAFA", borderTop: "1px solid #EEEEEE" }}>

        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#C4664A", marginBottom: "8px" }}>See it in action</p>
          <h2 className={`${playfair.className} text-[28px] md:text-[40px]`} style={{ fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, maxWidth: "640px", margin: "0 auto" }}>
            Your saves. Your family. One trip that works for everyone.
          </h2>
        </div>

        {/* Row cards */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", overflow: "hidden" }}>

          {/* Row 1 — Copy left, UI right */}
          <div className="flex flex-col md:flex-row p-8 md:px-14 md:py-16 gap-10 md:gap-16" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", alignItems: "center", overflow: "hidden" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#C4664A", marginBottom: "12px" }}>Step 1 — Save</p>
              <h3 className={playfair.className} style={{ fontSize: "32px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "16px" }}>Nothing gets lost. Ever again.</h3>
              <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.75 }}>See something on Instagram? Share it to Flokk. Google Maps star? Imported. TikTok reel? Saved with location, context, and category — automatically. If you can share it, we can save it.</p>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #EEEEEE", overflow: "hidden", width: "100%", maxWidth: "360px" }}>
                <div style={{ position: "relative", height: "180px", backgroundImage: "url('https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=640&q=80')", backgroundSize: "cover", backgroundPosition: "center" }}>
                  <div style={{ position: "absolute", bottom: "10px", left: "10px", backgroundColor: "#E1306C", color: "#fff", fontSize: "11px", padding: "3px 10px", borderRadius: "20px" }}>
                    Instagram
                  </div>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a", marginBottom: "4px" }}>Mercado de San Miguel</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "#717171" }}>Madrid, Spain</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    {["Food", "Market", "All ages"].map((tag) => (
                      <span key={tag} style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.05)", color: "#666", borderRadius: "20px", padding: "2px 8px" }}>{tag}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: "12px", color: "#999" }}>Saved from Instagram · 4 months ago</p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2 — UI left, Copy right */}
          <div className="flex flex-col md:flex-row-reverse p-8 md:px-14 md:py-16 gap-10 md:gap-16" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", alignItems: "center", overflow: "hidden" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#C4664A", marginBottom: "12px" }}>Step 2 — Surface</p>
              <h3 className={playfair.className} style={{ fontSize: "32px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "16px" }}>The right save, at exactly the right moment.</h3>
              <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.75 }}>You saved that aquarium six months ago. Now you&apos;re planning Okinawa. Flokk surfaces it — 600 metres from your hotel, open before your museum visit, and on the way to dinner!</p>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
              <div className="md:p-2">
                <div className="md:[transform:rotate(1.5deg)]" style={{ filter: "drop-shadow(0 16px 32px rgba(0,0,0,0.12))" }}>
                  <div className="rounded-2xl overflow-hidden border w-full" style={{ backgroundColor: "#fff", borderColor: "#EEEEEE", maxWidth: "340px" }}>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <span className="text-xs font-medium" style={{ color: "#999" }}>1.2km from your hotel</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://upload.wikimedia.org/wikipedia/commons/0/0a/Main_tank_of_the_Kuroshio_Sea_in_Okinawa_Churaumi_Aquarium.JPG" alt="Churaumi Aquarium" className="w-full object-cover" style={{ height: "150px" }} />
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>Churaumi Aquarium</p>
                        <p className="text-xs mt-0.5" style={{ color: "#999" }}>Okinawa, Japan · Saved 2 months ago from Google Maps</p>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "#717171" }}>Opens at 8:30am — perfect for morning. Kids under 6 free. Whale sharks year-round.</p>
                      <div className="flex gap-2 pt-1">
                        <button className="flex-1 text-sm font-semibold py-2 rounded-xl text-white" style={{ backgroundColor: "#1a1a1a" }}>Add to Tuesday</button>
                        <button className="px-4 text-sm font-medium rounded-xl border" style={{ borderColor: "#EEEEEE", color: "#717171" }}>Map</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 — Copy left, UI right */}
          <div className="flex flex-col md:flex-row p-8 md:px-14 md:py-16 gap-10 md:gap-16" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", alignItems: "center", overflow: "hidden" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#C4664A", marginBottom: "12px" }}>Step 3 — Plan</p>
              <h3 className={playfair.className} style={{ fontSize: "32px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "16px" }}>A real itinerary, built around your family.</h3>
              <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.75 }}>Day-by-day planning with travel times, weather, budget tracking, and a live map. Built from your saves and personalized recommendations — not a generic template.</p>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <div style={{ backgroundColor: "#FAFAFA", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #EEEEEE", overflow: "hidden", width: "100%", maxWidth: "360px" }}>
                {/* Day 1 — expanded */}
                <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #EEEEEE" }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Day 1 — Sun, May 4</p>
                      <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>☀️ 29°C · $420</p>
                    </div>
                    <span style={{ color: "#C4664A", fontSize: "14px", lineHeight: 1 }}>▴</span>
                  </div>
                  <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(196,102,74,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#C4664A" }}>FLT</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>JAL 917 → Naha</p>
                        <p style={{ fontSize: "11px", color: "#717171" }}>Flight · Dep. 08:40</p>
                      </div>
                    </div>
                    <div style={{ marginLeft: "17px", borderLeft: "2px solid #EEEEEE", padding: "6px 0 6px 16px" }}>
                      <p style={{ fontSize: "11px", color: "#999" }}>↓ 3h 10m travel time</p>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(196,102,74,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#C4664A" }}>HTL</span>
                      </div>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>Halekulani Okinawa</p>
                        <p style={{ fontSize: "11px", color: "#717171" }}>Lodging · Check-in 3pm</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Day 2 — collapsed */}
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #EEEEEE" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Day 2 — Mon, May 5</p>
                    <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>Katsuren Castle Ruins</p>
                  </div>
                  <span style={{ color: "#717171", fontSize: "14px", lineHeight: 1 }}>▾</span>
                </div>
                {/* Day 3 — collapsed */}
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>Day 3 — Tue, May 6</p>
                    <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>Free day · Okinawa</p>
                  </div>
                  <span style={{ color: "#717171", fontSize: "14px", lineHeight: 1 }}>▾</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4 — UI left, Copy right */}
          <div className="flex flex-col md:flex-row-reverse p-8 md:px-14 md:py-16 gap-10 md:gap-16" style={{ backgroundColor: "#FFFFFF", borderRadius: "20px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", alignItems: "center", overflow: "hidden" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#C4664A", marginBottom: "12px" }}>Step 4 — Personalize</p>
              <h3 className={playfair.className} style={{ fontSize: "32px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2, marginBottom: "16px" }}>Recommendations that actually know your family.</h3>
              <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.75 }}>Not &ldquo;top 10 things to do&rdquo;. Recommendations scored against your kids&apos; ages, your interests, your budget, and what families just like yours actually loved.</p>
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", border: "1px solid #EEEEEE", overflow: "hidden", width: "100%", maxWidth: "340px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://images.unsplash.com/photo-1693276206317-a78574082bfc?w=800&q=80" alt="Angkor Wat, Cambodia" style={{ width: "100%", height: "140px", objectFit: "cover", objectPosition: "center center", display: "block" }} />
                <div style={{ padding: "16px 20px 20px" }}>
                <span style={{ fontSize: "11px", backgroundColor: "rgba(196,102,74,0.1)", color: "#C4664A", borderRadius: "20px", padding: "3px 10px", fontWeight: 700 }}>Culture</span>
                <p style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a1a", margin: "12px 0 8px" }}>Angkor Wat</p>
                <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5, marginBottom: "16px" }}>History & Culture · Ages 5+ · UNESCO site · 3,104 families saved</p>
                <button style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "1.5px solid #C4664A", backgroundColor: "transparent", color: "#C4664A", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                  Save to trip
                </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Mini CTA */}
        <div style={{ textAlign: "center", padding: "32px 24px 0" }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: "#1a1a1a", marginBottom: "20px" }}>Ready to plan your next trip?</p>
          <Link
            href="/sign-up"
            className="inline-block font-semibold px-8 py-4 rounded-full text-base text-white"
            style={{ backgroundColor: "#C4664A" }}
          >
            Get early access — it&apos;s free →
          </Link>
          <p style={{ fontSize: "13px", color: "#999", marginTop: "12px" }}>No credit card required.</p>
        </div>

      </section>

      {/* What's coming — contained navy block */}
      <div className="px-4 sm:px-6 lg:px-8 mt-8">
      <section style={{ backgroundColor: "#1B3A5C" }} className="max-w-6xl mx-auto rounded-2xl py-10 md:py-12">
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 className={`${playfair.className} text-4xl md:text-5xl`} style={{ fontWeight: 400, color: "#fff", marginBottom: "12px" }}>More coming soon</h2>
            <p className="text-white/70" style={{ fontSize: "14px" }}>Flokk is just getting started. Here&apos;s what&apos;s on the horizon.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Dynamic Booking Portal",
                desc: "Hotels, flights, and experiences — all in one place, built around your family.",
              },
              {
                name: "Forward it. Done.",
                desc: "Send any booking confirmation to trips@flokktravel.com — we extract every detail.",
                live: true,
              },
              {
                name: "One Tap Navigation",
                desc: "Export your full day as a live route in Google or Apple Maps instantly.",
              },
              {
                name: "Perfect Calendar Sync",
                desc: "Every booking drops into your family calendar automatically. No manual entries.",
              },
              {
                name: "Earn & Track Points",
                desc: "Your miles and rewards surfaced alongside every search and booking.",
              },
              {
                name: "Pre-Vetted Family Trips",
                desc: "Real itineraries from families with kids the same ages and interests as yours.",
                live: true,
              },
            ].map(({ name, desc, live }) => (
              <div key={name} style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", padding: "28px 24px", border: "1px solid #E8E8E8", borderTopColor: "#C4664A", borderTopWidth: "3px", textAlign: "center", position: "relative", overflow: live ? "hidden" : undefined }}>
                {live && (
                  <div className="absolute top-3 right-[-28px] bg-[#C4664A] text-white text-[10px] font-bold uppercase tracking-wider px-8 py-1 rotate-45 shadow-sm">
                    Now Live
                  </div>
                )}
                <p style={{ color: "#1B3A5C", fontWeight: 600, fontSize: "18px", marginTop: 0, textAlign: "center" }}>{name}</p>
                <p style={{ color: "#717171", fontSize: "14px", marginTop: "8px", lineHeight: 1.5, textAlign: "center" }}>{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-white/50" style={{ textAlign: "center", fontSize: "14px", marginTop: "40px" }}>
            Beta access is free. Early adopters get priority access to everything above as it ships.
          </p>
        </div>
      </section>
      </div>

      {/* Community Section */}
      <section className="py-24 px-6" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: "#1a1a1a" }}>
              Steal someone else&apos;s homework. They won&apos;t mind.
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "#717171" }}>
              Type &ldquo;Tokyo, 8-year-old train obsessive, no shellfish.&rdquo; Someone already built that trip. Every restaurant, every activity, every hotel — borrow the whole thing and make it yours. When you get back, your version becomes the cheat sheet for the next family asking the exact same question.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                img: "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=800&q=80",
                destination: "Kyoto, Japan",
                family: "Family of 4 · Kids ages 7 & 10",
                tags: ["Kid-friendly", "10 days", "Gluten-free"],
                items: ["Fushimi Inari Shrine", "Arashiyama Bamboo Grove", "Kinkaku-ji Golden Pavilion"],
              },
              {
                img: "https://images.unsplash.com/photo-1746280359493-fb43a6d9bcc8?w=800&q=80",
                objPos: "center center",
                destination: "Costa Rica — Guanacaste",
                family: "Family of 5 · Kids ages 4, 9 & 12",
                tags: ["Adventure", "7 days", "All-inclusive"],
                items: ["Monteverde Cloud Forest", "Manuel Antonio Beach", "Arenal Volcano"],
              },
            ].map((trip) => (
              <div key={trip.destination} className="rounded-2xl overflow-hidden border shadow-sm" style={{ backgroundColor: "#fff", borderColor: "#EEEEEE" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={trip.img} alt={trip.destination} className="w-full h-44 object-cover" style={{ objectPosition: trip.objPos ?? "center center" }} />
                <div className="p-5 space-y-3">
                  <div>
                    <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>{trip.destination}</p>
                    <p className="text-sm mt-0.5" style={{ color: "#999" }}>{trip.family}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trip.tags.map((tag) => (
                      <span key={tag} className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: "#FAFAFA", color: "#6B8F71" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <ul className="space-y-1">
                    {trip.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm" style={{ color: "#717171" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#C4664A", flexShrink: 0, display: "inline-block" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full text-sm font-semibold py-2.5 rounded-xl border transition-colors" style={{ borderColor: "#EEEEEE", color: "#2d2d2d" }}>
                    Use this as my starting point
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="px-4 sm:px-6 lg:px-8">
      <section className="py-16 max-w-6xl mx-auto rounded-2xl" style={{ backgroundColor: "#B85D42" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">The numbers don&apos;t lie.</h2>
            <p className="mt-1 text-base" style={{ color: "rgba(255,255,255,0.7)" }}>Your spreadsheet does.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {[
              { stat: "20+ hrs", label: "The average family spends this researching every trip. You won't.", scale: false },
              { stat: "Built for families", label: "Not a generic travel app with a family filter bolted on.", scale: true },
              { stat: "All in one place", label: "Saves, itineraries, recommendations, and booking. No tab switching.", scale: false },
            ].map((item) => (
              <div
                key={item.stat}
                className="rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-3 border shadow-lg"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#EEEEEE",
                  transform: item.scale ? "scale(1.05)" : "scale(1)",
                }}
              >
                <p className="font-black leading-tight text-center" style={{ fontSize: "32px", color: "#1B3A5C" }}>{item.stat}</p>
                <p className="text-center leading-relaxed" style={{ color: "#717171", fontSize: "13px" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </div>

      {/* Features */}
      <section id="features" className="py-24 px-6" style={{ backgroundColor: "#fff" }}>
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center" style={{ color: "#1a1a1a" }}>
            Built around your family, not the other way around.
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                title: "Smart saves",
                hook: "Share a link. We handle the rest.",
                desc: "Share any link from Instagram, TikTok, Google Maps, Airbnb, Booking.com, email — anywhere. We automatically extract the name, location, and context. Your saves become searchable, filterable, and trip-ready.",
              },
              {
                title: "Personalized for your crew",
                hook: "Your family isn't generic. Your recommendations shouldn't be either.",
                desc: "Set up your family once — ages, interests, dietary needs, travel style, and more. Every recommendation and filter adapts to you automatically.",
              },
              {
                title: "Day-by-day itineraries",
                hook: "See what's close, what fits, and what your kids will actually enjoy.",
                desc: "Drag and drop your saves into a trip timeline. See what's close to your hotel, what's kid-friendly, and what fits your day.",
              },
              {
                title: "Trusted community",
                hook: "Families who've been there. With kids the same age. Same dietary needs.",
                desc: "Recommendations from families who've been there — with kids the same age, the same dietary needs, the same travel style.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl p-8 border" style={{ backgroundColor: "#FFFFFF", borderColor: "#EEEEEE", borderLeft: "4px solid #C4664A" }}>
                <h3 className="font-black mb-2" style={{ fontSize: "22px", color: "#1a1a1a" }}>{f.title}</h3>
                <p className="font-semibold text-sm mb-3" style={{ color: "#C4664A" }}>{f.hook}</p>
                <p className="text-sm leading-relaxed" style={{ color: "#717171" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section style={{ padding: "80px 24px", background: "#FFF8F3" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#C4664A", marginBottom: 16 }}>
            What families are saying
          </div>
          <blockquote style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.35, color: "#1B3A5C", margin: "0 0 24px 0" }}>
            &ldquo;Holy Crap, I just got a shiver it&rsquo;s so amazing. The packing section alone is so
            helpful and how it knows the temp where you are going and what to pack for kids...Love love
            love it!&rdquo;
          </blockquote>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1B3A5C" }}>Kristin</div>
          <div style={{ fontSize: 13, color: "#666" }}>Washington State</div>
        </div>
      </section>

      {/* No Kids callout */}
      <section className="px-6 pb-10" style={{ backgroundColor: "#fff" }}>
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center gap-4 border" style={{ backgroundColor: "#FAFAFA", borderColor: "#EEEEEE", borderLeft: "4px solid #6B8F71" }}>
            <div className="flex-1">
              <p className="font-black text-lg" style={{ color: "#1a1a1a" }}>No kids? No problem.</p>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "#717171" }}>
                Traveling with nieces, nephews, grandparents, or a group of adults who just really need a vacation — you&apos;re welcome here too. Great travel planning isn&apos;t only for parents.
              </p>
            </div>
            <Link href="/sign-up" className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded-full text-white whitespace-nowrap" style={{ backgroundColor: "#6B8F71" }}>
              Join us →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 text-center" style={{ backgroundColor: "#1B3A5C" }}>
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Your family&apos;s next great trip starts here.
          </h2>
          <p className="text-lg" style={{ color: "rgba(255,255,255,0.6)" }}>
            Join families already planning trips they&apos;ll actually remember.
          </p>
          <Link
            href="/sign-up"
            className="inline-block font-semibold px-8 py-4 rounded-full text-base transition-colors"
            style={{ backgroundColor: "#C4664A", color: "#fff" }}
          >
            Get early access — it&apos;s free →
          </Link>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>No credit card required.</p>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
