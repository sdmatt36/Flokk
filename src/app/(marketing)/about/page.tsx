import Image from "next/image";

// TO ADD PHOTOS:
// 1. Add photo file to /public/images/team/
// 2. Update image field: image: '/images/team/name.jpg'
// 3. Recommended: 400x400px square, face centered,
//    professional but warm — candid over posed

// TO ADD A NEW TEAM MEMBER OR ADVISOR:
// Add a new object to ADVISORS array with:
// name, title, image (or null), linkedin

const FOUNDERS = [
  {
    name: "Matt Greene",
    title: "Co-Founder",
    image: "/images/team/matt.jpeg",
    linkedin: "https://www.linkedin.com/in/mattgreene36/",
  },
  {
    name: "Jenifer Dasho",
    title: "Co-Founder",
    image: "/images/team/dasho.jpeg",
    linkedin: "https://www.linkedin.com/in/jenifer-luisi-dasho-22b7564/",
  },
];

const ADVISORS: typeof FOUNDERS = [
  // Empty for now — add advisors here when ready
  // {
  //   name: 'Advisor Name',
  //   title: 'Advisor — Travel & Hospitality',
  //   image: '/images/team/advisor.jpg',
  //   linkedin: 'https://linkedin.com/in/...',
  // },
];

const BELIEFS = [
  {
    title: "Planning should be half the fun.",
    body: "We believe the anticipation of a trip is part of the trip itself. Flokk is designed to make the planning phase something families look forward to, not dread.",
  },
  {
    title: "Your saves are an intention, not a to-do list.",
    body: "When you save something, you mean it. We take that seriously and make sure your saves become real experiences, not forgotten screenshots and abandoned tabs.",
  },
  {
    title: "Family travel is its own category.",
    body: "Travelling with kids is fundamentally different from travelling solo or as a couple. The tools that serve one don\u2019t serve the other. Flokk was built for families \u2014 but we welcome everyone.",
  },
  {
    title: "The best tip you\u2019ll ever get is from a family who just got back.",
    body: "Generic recommendations don\u2019t know your kids. Real ones come from families like yours who\u2019ve been there, done it, and want to help you do it better.",
  },
];

interface Person {
  name: string;
  title: string;
  image: string;
  linkedin: string;
}

function FounderCard({ person }: { person: Person }) {
  return (
    <div className="group">
      {/* Photo — circular crop */}
      <div className="relative mb-4 overflow-hidden rounded-full w-40 h-40">
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
        <p className="font-semibold text-[#1B3A5C] text-base leading-tight whitespace-nowrap">{person.name}</p>
        {person.linkedin && (
          <a
            href={person.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center mt-2 text-[#0077B5]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
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
            We love travel.<br />
            <em style={{ fontStyle: "italic", color: "#C4664A" }}>Planning it, less so.</em>
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", maxWidth: "580px", margin: "0 auto", lineHeight: 1.6 }}>
            A flock moves together. That&rsquo;s the whole idea.
          </p>
        </div>
      </section>

      {/* The story */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 32px" }}>The story</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              Between us, we&rsquo;ve lived in numerous countries, raised kids on planes, trains and Ubers, and spent more evenings than we&rsquo;d like staring at 50 open browser tabs trying to remember which one had the good restaurant in it.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We&rsquo;ve done the world schooling thing. We&rsquo;ve done weekend trips, long-haul adventures, road trips through national parks. We&rsquo;ve been the family asking &ldquo;did anyone screenshot that?&rdquo; in a group chat at 11pm the night before a flight.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              The information was always there. It was just <strong>everywhere</strong> &mdash; saves in one app, bookings in another, itineraries in a Google Doc nobody could share cleanly, and a graveyard of TikToks and Instagram posts we&rsquo;d never find again when it actually mattered.
            </p>
          </div>
        </div>
      </section>

      {/* Team */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

          {/* Section heading — upgraded from eyebrow */}
          <h2 className="font-['Playfair_Display'] text-4xl font-bold text-[#1B3A5C] text-center" style={{ marginBottom: "64px" }}>
            The team
          </h2>

          {/* Two-column: founder cards LEFT, quote RIGHT */}
          <div style={{ display: "flex", gap: "80px", alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center", marginBottom: "48px" }}>
            {/* LEFT — founder cards */}
            <div className="flex flex-col sm:flex-row gap-16 items-start">
              {FOUNDERS.map((person) => (
                <FounderCard key={person.name} person={person} />
              ))}
            </div>

            {/* RIGHT — quote block */}
            <div style={{ flex: 1, minWidth: "280px", maxWidth: "440px", paddingTop: "8px" }}>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "21px", fontStyle: "italic", color: "#1B3A5C", lineHeight: 1.7, margin: "0 0 20px" }}>
                &ldquo;You saved that restaurant from an Instagram reel six months ago. It&rsquo;s 400 metres from your hotel. Your kids like pizza. It has a kids menu. Want to add it to Tuesday?&rdquo;
              </p>
              <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A" }}>
                The moment Flokk exists to create
              </p>
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

      {/* Who we are */}
      <section style={{ backgroundColor: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "24px" }}>Who we are</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We are a small team. There is no PR department crafting an origin story. The story is that we kept planning trips the same broken way &mdash; saves in one place, bookings in another, itineraries in a Google Doc nobody could share cleanly, 50 open tabs &mdash; and eventually got annoyed enough to build something better.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We welcome every kind of family. The ones who travel twice a year. The ones who&rsquo;ve barely left the country and are planning their first real trip with kids. Road trippers to amazing national parks. The digital nomad families who plan continuously because they have no choice. <strong>You don&rsquo;t have to travel like us to get it.</strong> You just have to have ever lost a saved activity or restaurant in your Instagram saves folder and felt personally attacked by it.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              We build slowly and deliberately. We care a lot about getting this right &mdash; which means not shipping things that don&rsquo;t work (fingers crossed), not gating content that should be free, and not recommending things we wouldn&rsquo;t book ourselves.
            </p>
            <p style={{ fontSize: "17px", color: "#444", lineHeight: 1.8 }}>
              Flokk is the product we wanted. We hope it&rsquo;s the one you&rsquo;ve been looking for too.
            </p>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: "17px", color: "#717171", paddingTop: "24px", marginTop: "4px", borderTop: "1px solid #EEEEEE" }}>
              &ldquo;A flock moves together. That&rsquo;s the whole idea.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Beliefs */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "36px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 48px", textAlign: "center" }}>What we believe</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}>
            {BELIEFS.map((b) => (
              <div key={b.title} style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "32px", border: "1px solid #F0F0F0" }}>
                <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>{b.title}</h3>
                <p style={{ fontSize: "15px", color: "#717171", lineHeight: 1.7, margin: 0 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
