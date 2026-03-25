import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { AdminPhotosClient } from "./AdminPhotosClient";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

export default async function AdminPhotosPage() {
  const { userId } = await auth();
  const isAdmin = !!userId && ADMIN_USER_IDS.filter(Boolean).includes(userId.trim());

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F9F9F9" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</p>
          <p style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Access Denied</p>
          <p style={{ fontSize: "14px", color: "#717171" }}>This page is for Flokk admins only.</p>
          <Link href="/home" style={{ display: "inline-block", marginTop: "20px", fontSize: "14px", color: "#C4664A", fontWeight: 600 }}>← Back to home</Link>
        </div>
      </div>
    );
  }

  return <AdminPhotosClient />;
}
