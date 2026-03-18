import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";

// TO ADD PHOTOS:
// 1. Add photo file to /public/images/team/
// 2. Update image field: image: '/images/team/name.jpg'
// 3. Recommended: 400x400px square, face centered,
//    professional but warm — candid over posed

// TO ADD A NEW TEAM MEMBER OR ADVISOR:
// Add a new object to ADVISORS array with:
// name, title, image (or null), linkedin, favoriteSpot

const FOUNDERS = [
  {
    name: "Matt Greene",
    title: "Co-Founder",
    image: "/images/team/matt.jpeg",
    linkedin: "https://www.linkedin.com/in/mattgreene36/",
    favoriteSpot: "Okinawa, Japan",
  },
  {
    name: "Jenifer Dasho",
    title: "Co-Founder",
    image: "/images/team/dasho.jpeg",
    linkedin: "https://www.linkedin.com/in/jenifer-luisi-dasho-22b7564/",
    favoriteSpot: "",
  },
];

const ADVISORS: typeof FOUNDERS = [
  // Empty for now — add advisors here when ready
  // {
  //   name: 'Advisor Name',
  //   title: 'Advisor — Travel & Hospitality',
  //   image: '/images/team/advisor.jpg',
  //   linkedin: 'https://linkedin.com/in/...',
  //   favoriteSpot: 'Destination, Country',
  // },
];

const BELIEFS = [
  {
    title: "Planning should be half the fun",
    body: "We believe the anticipation of a trip is part of the trip itself. Flokk is designed to make the planning phase something families look forward to, not dread.",
  },
  {
    title: "Your saves are an intention, not a to-do list",
    body: "When you save something, you mean it. We take that seriously and make sure your saves become real experiences, not forgotten screenshots.",
  },
  {
    title: "Family travel is its own category",
    body: "Traveling with kids is fundamentally different from traveling solo or as a couple. The tools that serve one don\u2019t serve the other. Flokk was built exclusively for families.",
  },
  {
    title: "Bootstrapped means honest",
    body: "We\u2019re independently funded. That means we build what\u2019s good for families, not what\u2019s good for advertisers. We will never sell your data or show you ads.",
  },
];

interface Person {
  name: string;
  title: string;
  image: string;
  linkedin: string;
  favoriteSpot: string;
}

function FounderCard({ person }: { person: Person }) {
  return (
    <div className="group">
      {/* Photo — circular crop */}
      <div className="relative mb-4 overflow-hidden rounded-full aspect-square">
        <Image
          src={person.image}
          alt={person.name}
          fill
          className="object-cover object-top"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {/* LinkedIn badge — hover reveal */}
        {person.linkedin && (
          <a
            href={person.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <svg className="w-4 h-4 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
        )}
      </div>
      {/* Info */}
      <div className="text-center">
        <p className="font-semibold text-[#1B3A5C] text-base leading-tight">{person.name}</p>
        <p className="text-sm text-[#717171] mt-0.5">{person.title}</p>
        {person.linkedin && (
          <a
            href={person.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-[#0077B5] hover:underline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
        )}
        {person.favoriteSpot && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <MapPin className="w-3 h-3 text-[#C4664A] flex-shrink-0" />
            <span className="text-xs text-[#717171]">{person.favoriteSpot}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>About</p>
          <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl md:text-5xl font-semibold text-white max-w-2xl mx-auto leading-tight text-center" style={{ marginBottom: "24px" }}>
            Built by a family that got tired of losing the list.
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "580px", margin: "0 auto", lineHeight: 1.6 }}>
            Flokk started as a personal problem. It became an obsession. Now it's a product families can actually use.
          </p>
        </div>
      </section>

      {/* Founder story */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 32px" }}>The story</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              My family moves a lot. We've lived in three countries and taken more trips than I can count. Every time we plan one, the same thing happens: I spend hours scrolling Instagram saves, Googling restaurants I already found once, and trying to remember which TikTok had that hotel in it.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              The information is out there. The problem is that it's everywhere. In saves, in screenshots, in group chats, in browser tabs. None of it is connected, and none of it knows anything about my family.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              Flokk is the product I wanted. One place to save anything, that remembers what my kids like, that knows where I'm going, and that helps me build a plan that actually works when we get there.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We're independent, fully bootstrapped, and distributed across time zones. We build slowly and deliberately, and we care a lot about getting this right.
            </p>
          </div>
        </div>
      </section>

      {/* Team — positioned ABOVE "What we believe" */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

          {/* Section header */}
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "12px" }}>The team</p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>The people behind Flokk</h2>
          </div>

          {/* Founders */}
          <div style={{ marginBottom: "48px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#717171", marginBottom: "24px" }}>Founders</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8" style={{ maxWidth: "480px" }}>
              {FOUNDERS.map((person) => (
                <FounderCard key={person.name} person={person} />
              ))}
            </div>
          </div>

          {/* Advisors & Team — shown when populated */}
          {ADVISORS.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#717171", marginBottom: "24px" }}>Advisors & Team</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {ADVISORS.map((person) => (
                  <FounderCard key={person.name} person={person} />
                ))}
              </div>
            </div>
          )}

          {/* Coming soon placeholder — shows when advisors empty */}
          {ADVISORS.length === 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#717171", marginBottom: "24px" }}>Advisors & Team</p>
              <div style={{ border: "2px dashed #E0E0E0", borderRadius: "16px", padding: "40px 24px", textAlign: "center", backgroundColor: "#fff" }}>
                <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>Growing the team — check back soon.</p>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Beliefs */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>What we believe</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
            {BELIEFS.map((b) => (
              <div key={b.title} style={{ backgroundColor: "#F9F9F9", borderRadius: "16px", padding: "32px", border: "1px solid #F0F0F0" }}>
                <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>{b.title}</h3>
                <p style={{ fontSize: "15px", color: "#717171", lineHeight: 1.7, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proudly independent */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "40px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>Proudly independent.</h2>
            <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", margin: 0 }}>No investors. No ads. No BS.</p>
          </div>
          <Link href="/contact" style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "14px 32px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Get in touch &rarr;</Link>
        </div>
      </section>
    </div>
  );
}
