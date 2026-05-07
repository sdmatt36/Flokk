import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });

const TOUR_FALLBACK = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";

export interface TourCardProps {
  id: string;
  title: string;
  destinationCity: string;
  destinationCountry: string | null;
  shareToken: string | null;
  stopCount: number;
  transport: string;
}

export function TourCard({ tour }: { tour: TourCardProps }) {
  const href = tour.shareToken ? `/share/${tour.shareToken}` : `/tour`;

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", width: "100%" }}>
      <div style={{
        borderRadius: "16px", overflow: "hidden",
        border: "1.5px solid #EEEEEE", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        position: "relative",
        aspectRatio: "4/3",
        backgroundImage: `url('${TOUR_FALLBACK}')`,
        backgroundSize: "cover", backgroundPosition: "center",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%)" }} />
        <span style={{
          position: "absolute", top: "8px", left: "8px",
          fontSize: "10px", fontWeight: 600, color: "#fff",
          backgroundColor: "rgba(27,58,92,0.92)", borderRadius: "10px", padding: "2px 8px",
        }}>
          {tour.stopCount} {tour.stopCount === 1 ? "stop" : "stops"}
        </span>
        <div style={{ position: "absolute", bottom: "12px", left: "12px", right: "12px" }}>
          <p
            className={playfair.className}
            style={{
              fontSize: "18px", fontWeight: 700, color: "#fff",
              lineHeight: 1.25, margin: 0,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {tour.title}
          </p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", marginTop: "4px", margin: "4px 0 0" }}>
            {[tour.destinationCity, tour.destinationCountry].filter(Boolean).join(", ")} · {tour.transport}
          </p>
        </div>
      </div>
    </Link>
  );
}
