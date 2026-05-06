import Link from "next/link";

interface SubmitContentCTAProps {
  cityName: string;
}

export function SubmitContentCTA({ cityName }: SubmitContentCTAProps) {
  return (
    <div style={{
      margin: "48px 0 0",
      padding: "32px 28px",
      backgroundColor: "#1B3A5C",
      borderRadius: "16px",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
        Know {cityName}?
      </p>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", margin: "0 0 20px" }}>
        Share what&apos;s worth visiting — restaurants, activities, hidden gems. Every pick helps families plan better.
      </p>
      <Link
        href="/discover/spots"
        style={{
          display: "inline-block",
          fontSize: "14px", fontWeight: 700,
          backgroundColor: "#C4664A", color: "#fff",
          padding: "10px 22px", borderRadius: "20px",
          textDecoration: "none",
        }}
      >
        Share a pick
      </Link>
    </div>
  );
}
