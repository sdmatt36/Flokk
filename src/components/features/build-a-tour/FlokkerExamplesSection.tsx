"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type SampleTour = {
  title: string;
  image: string;
  rating: number;
  stops: number;
  duration: string;
  pacing: string;
  examplePrompt: string;
};

const SAMPLE_TOURS: SampleTour[] = [
  {
    title: "Tokyo with little kids",
    image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
    rating: 4.9,
    stops: 7,
    duration: "Half day",
    pacing: "Family-paced",
    examplePrompt: "A morning tour in Tokyo for a family with kids ages 5 and 8. Food markets, a temple, a park, ramen lunch. Walking only.",
  },
  {
    title: "Edinburgh weekend with teens",
    image: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800&q=80",
    rating: 4.8,
    stops: 6,
    duration: "Full day",
    pacing: "Active",
    examplePrompt: "An Edinburgh tour for parents with teens. Castle, Royal Mile, ghost stories, late dinner. They want some grit, not too touristy.",
  },
  {
    title: "Aspen winter day",
    image: "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80",
    rating: 4.9,
    stops: 5,
    duration: "Full day",
    pacing: "Family-paced",
    examplePrompt: "An Aspen winter day for a family — a few hours skiing, hot chocolate, downtown stroll, casual dinner.",
  },
  {
    title: "Cambodia temples & culture",
    image: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&q=80",
    rating: 4.8,
    stops: 8,
    duration: "Full day",
    pacing: "Adventure",
    examplePrompt: "A Siem Reap day exploring Angkor Wat and surrounding temples for an adventurous family. Sunrise start, early evening end.",
  },
  {
    title: "Bangkok food & night markets",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
    rating: 4.7,
    stops: 6,
    duration: "Half day evening",
    pacing: "Active",
    examplePrompt: "An evening Bangkok tour — street food, night markets, tuk tuk rides. Family with one teen, one tween.",
  },
  {
    title: "Paris with grandparents",
    image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
    rating: 4.9,
    stops: 6,
    duration: "Full day",
    pacing: "Relaxed",
    examplePrompt: "A relaxed Paris day for a multi-generational family — grandparents, parents, kids. Iconic spots, lots of café breaks, no walking marathons.",
  },
];

type Props = {
  userTourCount: number;
  onSelectExample: (prompt: string) => void;
};

function FlokkerExamplesSectionInner({ userTourCount, onSelectExample }: Props) {
  const searchParams = useSearchParams();
  const showOverride = searchParams.get("showExamples") === "true";

  if (userTourCount > 0 && !showOverride) return null;

  function handleCardClick(examplePrompt: string) {
    onSelectExample(examplePrompt);
    document.querySelector(".tour-form-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", marginTop: 96, paddingBottom: 80 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: "11px", color: "#C4664A", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px", fontFamily: "DM Sans, system-ui, sans-serif" }}>
            FLOKKER EXAMPLES
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 700, color: "#1B3A5C", margin: 0, lineHeight: 1.2 }}>
            Built by Flokk families
          </h2>
        </div>
        <p style={{ fontSize: "13px", color: "#555", fontStyle: "italic", margin: 0, fontFamily: "DM Sans, system-ui, sans-serif" }}>
          3,200 tours built this week
        </p>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 16 }}>
        {SAMPLE_TOURS.map((tour) => (
          <div
            key={tour.title}
            onClick={() => handleCardClick(tour.examplePrompt)}
            style={{
              position: "relative",
              aspectRatio: "4/3",
              borderRadius: "12px",
              overflow: "hidden",
              cursor: "pointer",
              backgroundImage: `url(${tour.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: "#F3EDE3",
            }}
          >
            {/* Dark gradient overlay */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.78) 100%)" }} />

            {/* Top-left FLOKKER badge */}
            <div style={{
              position: "absolute", top: 10, left: 10,
              padding: "4px 10px",
              background: "#C4664A",
              borderRadius: "14px",
              fontSize: "11px", fontWeight: 600, color: "white",
              fontFamily: "DM Sans, system-ui, sans-serif",
              zIndex: 1,
            }}>
              FLOKKER
            </div>

            {/* Top-right rating badge */}
            <div style={{
              position: "absolute", top: 10, right: 10,
              padding: "4px 8px",
              background: "rgba(255,255,255,0.92)",
              borderRadius: "12px",
              fontSize: "11px", fontWeight: 500, color: "#1B3A5C",
              fontFamily: "DM Sans, system-ui, sans-serif",
              zIndex: 1,
            }}>
              ★ {tour.rating}
            </div>

            {/* Bottom content */}
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, zIndex: 1 }}>
              <p style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "18px", fontWeight: 700, color: "white",
                margin: "0 0 5px", lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {tour.title}
              </p>
              <p style={{ fontSize: "12px", color: "white", opacity: 0.92, margin: 0, lineHeight: 1.4, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                {tour.stops} stops · {tour.duration} · {tour.pacing}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlokkerExamplesSection(props: Props) {
  return (
    <Suspense fallback={null}>
      <FlokkerExamplesSectionInner {...props} />
    </Suspense>
  );
}
