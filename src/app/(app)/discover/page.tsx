"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, Play, X } from "lucide-react";

type Recommendation = {
  id: string;
  city: string;
  country: string;
  tag: string;
  region: string;
  why: string;
  pickReason: string;
  img: string;
  communityTripId: string | null;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r1",
    city: "Kyoto",
    country: "Japan",
    tag: "Culture",
    region: "Asia",
    why: "UNESCO temples, bamboo forests, and night food markets — ideal for curious kids.",
    pickReason: "Matches your love of history and slow travel with kids.",
    img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-kyoto-may25",
  },
  {
    id: "r2",
    city: "Lisbon",
    country: "Portugal",
    tag: "City Break",
    region: "Europe",
    why: "Mild weather, safe neighborhoods, easy transit, and some of Europe's best pastries.",
    pickReason: "Highly rated by families who value walkability and great food.",
    img: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-lisbon-jul25",
  },
  {
    id: "r3",
    city: "Amalfi Coast",
    country: "Italy",
    tag: "Beach",
    region: "Europe",
    why: "Dramatic cliffs, turquoise water, and villages your kids will remember forever.",
    pickReason: "A top pick for families who've loved coastal destinations.",
    img: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r4",
    city: "Prague",
    country: "Czech Republic",
    tag: "Culture",
    region: "Europe",
    why: "Fairy-tale architecture, walkable old town, and budget-friendly family dining.",
    pickReason: "Families who loved Vienna and Budapest consistently rate Prague next.",
    img: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r5",
    city: "Madrid",
    country: "Spain",
    tag: "Food",
    region: "Europe",
    why: "World-class museums, late-night tapas culture, and kid-friendly parks everywhere.",
    pickReason: "Perfect for food-first families who want culture on the side.",
    img: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&auto=format&fit=crop&q=80",
    communityTripId: "cmtrip-madrid-jun25",
  },
  {
    id: "r6",
    city: "Barcelona",
    country: "Spain",
    tag: "Outdoor",
    region: "Europe",
    why: "Gaudí, beaches, and a food scene that makes everyone happy — including picky eaters.",
    pickReason: "Ranked #1 by families who want cities with beach access.",
    img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r7",
    city: "Bali",
    country: "Indonesia",
    tag: "Beach",
    region: "Asia",
    why: "Rice terraces, temple ceremonies, and warm shallow seas that kids adore.",
    pickReason: "A consistent favorite for families seeking beach + culture in Asia.",
    img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
  {
    id: "r8",
    city: "Hokkaido",
    country: "Japan",
    tag: "Adventure",
    region: "Asia",
    why: "World-class skiing, hot springs, and farm-to-table dairy that kids go wild for.",
    pickReason: "Top pick for active families after a Japan alpine experience.",
    img: "https://images.unsplash.com/photo-1542931287-023b922fa89b?w=600&auto=format&fit=crop&q=80",
    communityTripId: null,
  },
];

function getDestinationHref(rec: Recommendation): string {
  if (rec.communityTripId) return `/trips/${rec.communityTripId}`;
  return `/trips/new?destination=${encodeURIComponent(rec.city)}&country=${encodeURIComponent(rec.country)}`;
}

const FILTERS = ["All", "Culture", "Food", "Outdoor", "Adventure", "Beach", "City Break", "Asia", "Europe"];

type CommunityTrip = {
  tripId: string | null;
  heroImage: string;
  title: string;
  destination: string;
  destCity: string;
  destCountry: string;
  duration: string;
  tags: string[];
  highlights: string[];
  familyName: string;
};

const COMMUNITY_TRIPS: CommunityTrip[] = [
  {
    tripId: "cmtrip-kyoto-may25",
    heroImage: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80",
    title: "Kyoto with Kids",
    destination: "Kyoto, Japan",
    destCity: "Kyoto",
    destCountry: "Japan",
    duration: "7 days",
    tags: ["Culture", "Food"],
    highlights: ["Fushimi Inari", "Arashiyama", "Nishiki Market"],
    familyName: "The Tanaka Family",
  },
  {
    tripId: "cmtrip-madrid-jun25",
    heroImage: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&auto=format&fit=crop&q=80",
    title: "Madrid Long Weekend",
    destination: "Madrid, Spain",
    destCity: "Madrid",
    destCountry: "Spain",
    duration: "4 days",
    tags: ["Food", "Culture"],
    highlights: ["El Prado", "Retiro Park", "Mercado San Miguel"],
    familyName: "The Garcia Family",
  },
  {
    tripId: "cmtrip-lisbon-jul25",
    heroImage: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&auto=format&fit=crop&q=80",
    title: "Long Weekend in Lisbon",
    destination: "Lisbon, Portugal",
    destCity: "Lisbon",
    destCountry: "Portugal",
    duration: "4 days",
    tags: ["City Break", "Food"],
    highlights: ["Alfama trams", "Pastéis de Belém", "Sintra day trip"],
    familyName: "The Andersons",
  },
  {
    tripId: null,
    heroImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&auto=format&fit=crop&q=80",
    title: "Bali Slow Travel",
    destination: "Bali, Indonesia",
    destCity: "Bali",
    destCountry: "Indonesia",
    duration: "14 days",
    tags: ["Beach", "Culture"],
    highlights: ["Ubud rice terraces", "Seminyak beach", "Tirta Empul"],
    familyName: "The Park Family",
  },
];

function getCommunityTripHref(trip: CommunityTrip): string {
  if (trip.tripId) return `/trips/${trip.tripId}`;
  return `/trips/new?destination=${encodeURIComponent(trip.destCity)}&country=${encodeURIComponent(trip.destCountry)}`;
}

// ── Travel Intel types ────────────────────────────────────────────────────────

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  authorType: string;
  tags: string[];
  publishedAt: string | null;
};

type TravelVideo = {
  id: string;
  title: string;
  videoUrl: string;
  platform: string;
  embedId: string;
  thumbnailUrl: string | null;
  destination: string | null;
  submittedBy: string | null;
};

type FeedItem = {
  id: string;
  rawTitle: string | null;
  mediaThumbnailUrl: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  categoryTags: string[];
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  return (
    <div
      className="hover:shadow-md transition-shadow duration-200"
      style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #EEEEEE", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}
    >
      <div style={{ height: "120px", backgroundColor: "#1B3A5C", position: "relative" }}>
        {article.coverImage ? (
          <img src={article.coverImage} alt={article.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>F</span>
          </div>
        )}
        <div style={{ position: "absolute", top: "8px", left: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(196,102,74,0.9)", color: "#fff", borderRadius: "20px", padding: "2px 8px" }}>
            {article.tags[0] ?? "Guide"}
          </span>
        </div>
      </div>
      <div style={{ padding: "12px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, marginBottom: "6px" }}>{article.title}</p>
        <p style={{ fontSize: "11px", color: "#717171", lineHeight: 1.4 }}>{article.excerpt}</p>
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: TravelVideo; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="hover:shadow-md transition-shadow duration-200"
      style={{ cursor: "pointer", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #EEEEEE", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      <div style={{ height: "120px", backgroundColor: "#1a1a1a", position: "relative" }}>
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundColor: "#1B3A5C" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={18} style={{ color: "#1a1a1a", marginLeft: "2px" }} fill="#1a1a1a" />
          </div>
        </div>
        <div style={{ position: "absolute", top: "8px", right: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: video.platform === "youtube" ? "#FF0000" : "#010101", color: "#fff", borderRadius: "20px", padding: "2px 8px" }}>
            {video.platform === "youtube" ? "YouTube" : "TikTok"}
          </span>
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{video.title}</p>
        {video.destination && (
          <p style={{ fontSize: "11px", color: "#717171", marginTop: "4px" }}>{video.destination}</p>
        )}
      </div>
    </div>
  );
}

function CommunityFeedCard({ item }: { item: FeedItem }) {
  const loc = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #EEEEEE", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ height: "100px", backgroundColor: "#1B3A5C", position: "relative" }}>
        {item.mediaThumbnailUrl && (
          <img src={item.mediaThumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{item.rawTitle ?? "Saved place"}</p>
        {loc && <p style={{ fontSize: "11px", color: "#717171", marginTop: "2px" }}>{loc}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
          {item.categoryTags.slice(0, 2).map((tag) => (
            <span key={tag} style={{ fontSize: "10px", backgroundColor: "rgba(0,0,0,0.05)", color: "#666", borderRadius: "20px", padding: "2px 7px" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [intelTab, setIntelTab] = useState<"articles" | "videos" | "community">("articles");
  const [flokkArticles, setFlokkArticles] = useState<Article[]>([]);
  const [communityArticles, setCommunityArticles] = useState<Article[]>([]);
  const [flokkVideos, setFlokkVideos] = useState<TravelVideo[]>([]);
  const [communityVideos, setCommunityVideos] = useState<TravelVideo[]>([]);
  const [communityFeed, setCommunityFeed] = useState<FeedItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<TravelVideo | null>(null);

  // Fetch articles on mount
  useEffect(() => {
    fetch("/api/travel-intel/articles")
      .then((r) => r.json())
      .then((data: Article[]) => {
        setFlokkArticles(data.filter((a) => a.authorType === "flokk"));
        setCommunityArticles(data.filter((a) => a.authorType !== "flokk"));
      })
      .catch(() => {});
  }, []);

  // Fetch videos or community feed when tab changes
  useEffect(() => {
    if (intelTab === "videos") {
      fetch("/api/travel-intel/videos")
        .then((r) => r.json())
        .then((data: TravelVideo[]) => {
          setFlokkVideos(data.filter((v) => !v.submittedBy));
          setCommunityVideos(data.filter((v) => !!v.submittedBy));
        })
        .catch(() => {});
    } else if (intelTab === "community") {
      fetch("/api/travel-intel/feed")
        .then((r) => r.json())
        .then(setCommunityFeed)
        .catch(() => {});
    }
  }, [intelTab]);

  const filtered =
    activeFilter === "All"
      ? RECOMMENDATIONS
      : RECOMMENDATIONS.filter((r) => r.tag === activeFilter || r.region === activeFilter);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "6px" }}>
            Get inspired
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2 }}>
            Picked for your family
          </h1>
          <p style={{ fontSize: "14px", color: "#717171", marginTop: "6px", lineHeight: 1.5 }}>
            Based on your interests and travel style — places families like yours love.
          </p>
        </div>

        {/* Filter bar */}
        <div
          style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "20px", scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="hide-scrollbar"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: "999px",
                border: activeFilter === f ? "none" : "1.5px solid #E0E0E0",
                backgroundColor: activeFilter === f ? "#C4664A" : "#fff",
                color: activeFilter === f ? "#fff" : "#717171",
                fontSize: "13px",
                fontWeight: activeFilter === f ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Destination grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
            {filtered.map((rec) => (
              <Link key={rec.id} href={getDestinationHref(rec)} style={{ textDecoration: "none", display: "block" }}>
                <div
                  className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  style={{ backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ height: "160px", backgroundImage: `url(${rec.img})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                    <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#C4664A", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                        {rec.tag}
                      </span>
                    </div>
                    {rec.communityTripId && (
                      <div style={{ position: "absolute", top: "10px", right: "10px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(27,58,92,0.85)", backdropFilter: "blur(4px)", color: "#fff", borderRadius: "20px", padding: "3px 10px" }}>
                          Community trip
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                      <MapPin size={12} style={{ color: "#C4664A", flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>
                        {rec.city}, {rec.country}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#717171", lineHeight: 1.5, marginBottom: "10px" }}>{rec.why}</p>
                    <p style={{ fontSize: "11px", color: "#C4664A", lineHeight: 1.4, fontWeight: 500 }}>{rec.pickReason}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#717171" }}>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a1a", marginBottom: "6px" }}>No destinations here yet</p>
            <p style={{ fontSize: "13px" }}>More {activeFilter} picks coming soon.</p>
          </div>
        )}

        {/* Community trips strip */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "2px" }}>
                Trips families like yours loved
              </h2>
              <p style={{ fontSize: "13px", color: "#717171" }}>Real itineraries from the Flokk community</p>
            </div>
            <Link href="/trips/new" style={{ fontSize: "12px", color: "#C4664A", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
              Add yours <ChevronRight size={13} />
            </Link>
          </div>
          <div
            style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="hide-scrollbar"
          >
            {COMMUNITY_TRIPS.map((trip) => (
              <Link key={trip.tripId ?? trip.title} href={getCommunityTripHref(trip)} style={{ textDecoration: "none", flexShrink: 0 }}>
                <div
                  className="hover:shadow-md transition-shadow duration-200"
                  style={{ width: "220px", backgroundColor: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #EEEEEE", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
                >
                  <div style={{ height: "120px", backgroundImage: `url(${trip.heroImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
                    <div style={{ position: "absolute", bottom: "8px", left: "10px", right: "10px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{trip.title}</p>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                      <MapPin size={11} style={{ color: "#C4664A", flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "#2d2d2d", fontWeight: 600 }}>{trip.destination}</span>
                    </div>
                    <p style={{ fontSize: "11px", color: "#717171", marginBottom: "6px" }}>{trip.duration} · {trip.tags.join(", ")}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {trip.highlights.slice(0, 2).map((h) => (
                        <span key={h} style={{ fontSize: "10px", backgroundColor: "rgba(196,102,74,0.08)", color: "#C4664A", borderRadius: "6px", padding: "2px 7px", fontWeight: 500 }}>
                          {h}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: "10px", color: "#AAAAAA", marginTop: "8px" }}>by {trip.familyName}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Travel Intel */}
        <div style={{ marginTop: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", marginBottom: "4px" }}>Travel Intel</h2>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px" }}>Guides, videos, and community picks</p>

          {/* Tab bar */}
          <div
            style={{ display: "flex", borderBottom: "1px solid #E8E8E8", marginBottom: "20px", overflowX: "auto" }}
            className="hide-scrollbar"
          >
            {(["articles", "videos", "community"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setIntelTab(tab)}
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: intelTab === tab ? 700 : 500,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  borderBottom: intelTab === tab ? "2px solid #C4664A" : "2px solid transparent",
                  color: intelTab === tab ? "#1B3A5C" : "#888",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                  marginBottom: "-1px",
                }}
              >
                {tab === "articles" ? "Articles" : tab === "videos" ? "Videos" : "Community"}
              </button>
            ))}
          </div>

          {/* Articles tab */}
          {intelTab === "articles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  From Flokk
                </p>
                {flokkArticles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "12px" }}>
                    {flokkArticles.map((a) => <ArticleCard key={a.id} article={a} />)}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>
                    Flokk guides and destination deep-dives coming soon.
                  </p>
                )}
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  From the community
                </p>
                {communityArticles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "12px" }}>
                    {communityArticles.map((a) => <ArticleCard key={a.id} article={a} />)}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>
                    <span style={{ color: "#C4664A", fontWeight: 500, cursor: "pointer" }}>Share your knowledge →</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Videos tab */}
          {intelTab === "videos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  Flokk Picks
                </p>
                {flokkVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "12px" }}>
                    {flokkVideos.map((v) => <VideoCard key={v.id} video={v} onPlay={() => setActiveVideo(v)} />)}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>Curated travel videos coming soon.</p>
                )}
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#717171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  Community Videos
                </p>
                {communityVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "12px" }}>
                    {communityVideos.map((v) => <VideoCard key={v.id} video={v} onPlay={() => setActiveVideo(v)} />)}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>Submit a travel video and it'll appear here.</p>
                )}
              </div>
            </div>
          )}

          {/* Community tab */}
          {intelTab === "community" && (
            <div>
              {communityFeed.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "12px" }}>
                  {communityFeed.map((item) => <CommunityFeedCard key={item.id} item={item} />)}
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: "#aaa", padding: "8px 0" }}>
                  No community saves yet. Start sharing your public trips!
                </p>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: "40px", textAlign: "center", paddingBottom: "8px" }}>
          <p style={{ fontSize: "13px", color: "#717171", marginBottom: "12px" }}>
            Ready to start planning one of these?
          </p>
          <Link
            href="/trips/new"
            style={{ display: "inline-block", padding: "12px 28px", backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "14px", borderRadius: "999px", textDecoration: "none" }}
          >
            Add a trip
          </Link>
        </div>

      </div>

      {/* Video modal */}
      {activeVideo && (
        <div
          onClick={() => setActiveVideo(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "640px", backgroundColor: "#000", borderRadius: "12px", overflow: "hidden", position: "relative" }}
          >
            <button
              onClick={() => setActiveVideo(null)}
              style={{ position: "absolute", top: "8px", right: "8px", zIndex: 1, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <X size={16} style={{ color: "#fff" }} />
            </button>
            {activeVideo.platform === "youtube" ? (
              <div style={{ position: "relative", paddingTop: "56.25%" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${activeVideo.embedId}?autoplay=1`}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "#fff" }}>
                <p style={{ fontWeight: 600, marginBottom: "16px" }}>{activeVideo.title}</p>
                <a
                  href={activeVideo.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#C4664A", fontSize: "14px", fontWeight: 500 }}
                >
                  Watch on TikTok →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
