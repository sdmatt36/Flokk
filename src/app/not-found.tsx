import Link from "next/link";
import { FlokkWordmark } from "@/components/ui/FlokkWordmark";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF6EF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "32px 24px",
        textAlign: "center",
      }}
    >
      <FlokkWordmark size={28} />
      <div>
        <p
          style={{
            fontSize: "80px",
            fontWeight: 800,
            color: "#1B3A5C",
            lineHeight: 1,
            margin: "0 0 8px",
            opacity: 0.12,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#1B3A5C",
            margin: "0 0 8px",
          }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: "15px", color: "#717171", margin: "0 0 24px" }}>
          That page doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            backgroundColor: "#1B3A5C",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
