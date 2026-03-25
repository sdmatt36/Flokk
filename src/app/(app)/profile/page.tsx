"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { FamilySection } from "@/components/features/profile/FamilySection";
import { TravelersSection } from "@/components/features/profile/TravelersSection";
import { PaymentSection } from "@/components/features/profile/PaymentSection";
import { LoyaltySection } from "@/components/features/profile/LoyaltySection";
import { TravelDocsSection } from "@/components/features/profile/TravelDocsSection";
import { StatsSection } from "@/components/features/profile/StatsSection";

const NAV_ITEMS = [
  { id: "family", label: "Family", subtitle: "Your household details and travel preferences." },
  { id: "travelers", label: "Travelers", subtitle: "Everyone traveling with your family." },
  { id: "payment", label: "Payment", subtitle: "Cards you use for travel." },
  { id: "loyalty", label: "Loyalty", subtitle: "Your airline, hotel, and car rental memberships." },
  { id: "docs", label: "Travel Docs", subtitle: "Passports, trusted traveler programs, and document reminders." },
  { id: "stats", label: "Stats", subtitle: "Your family's travel history at a glance." },
];

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "family";
  const [activeSection, setActiveSection] = useState(initialTab);
  const [isDesktop, setIsDesktop] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const verifyStatus = searchParams.get("verify");
  const [verifyToast, setVerifyToast] = useState<string | null>(
    verifyStatus === "ok" ? "Email verified — you can now forward bookings from this address ✓"
    : verifyStatus === "expired" ? "Verification link expired — please request a new one."
    : verifyStatus === "invalid" ? "Invalid or already-used verification link."
    : null
  );
  useEffect(() => {
    if (verifyToast) {
      const t = setTimeout(() => setVerifyToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [verifyToast]);

  const active = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  function renderSection() {
    switch (activeSection) {
      case "family": return <FamilySection />;
      case "travelers": return <TravelersSection />;
      case "payment": return <PaymentSection />;
      case "loyalty": return <LoyaltySection />;
      case "docs": return <TravelDocsSection />;
      case "stats": return <StatsSection />;
      default: return <FamilySection />;
    }
  }

  // ── Sidebar nav item ────────────────────────────────────────────────────────
  function NavItem({ item }: { item: typeof NAV_ITEMS[0] }) {
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveSection(item.id)}
        style={{
          display: "flex", alignItems: "center",
          width: "100%", textAlign: "left", padding: "10px 12px",
          borderRadius: "8px", border: "none", cursor: "pointer",
          borderLeft: isActive ? "2px solid #C4664A" : "2px solid transparent",
          backgroundColor: isActive ? "rgba(27,58,92,0.07)" : "transparent",
          color: isActive ? "#1B3A5C" : "#717171",
          fontWeight: isActive ? 500 : 400,
          fontSize: "14px",
          transition: "background-color 0.15s",
        }}
      >
        {item.label}
      </button>
    );
  }

  const toastColor = verifyStatus === "ok" ? "#4a7c59" : "#C4664A";

  // ── Desktop layout ──────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F9F9F9" }}>
        {verifyToast && (
          <div style={{ position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)", backgroundColor: toastColor, color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none" }}>
            {verifyToast}
          </div>
        )}
        {/* Sidebar */}
        <aside style={{
          width: "240px", flexShrink: 0,
          borderRight: "1px solid #E8E8E8",
          backgroundColor: "#fff",
          position: "sticky", top: 0, height: "100vh",
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "24px 16px 12px" }}>
            <p style={{ fontSize: "18px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Profile</p>
          </div>
          <nav style={{ flex: 1, padding: "4px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {NAV_ITEMS.map((item) => <NavItem key={item.id} item={item} />)}
          </nav>
          <div style={{ padding: "16px", borderTop: "1px solid #E8E8E8" }}>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a1a", margin: "0 0 2px" }}>{fullName}</p>
            <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 12px" }}>{email}</p>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: "#e53e3e", fontWeight: 500, padding: 0,
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Section header */}
          <div style={{
            padding: "32px 32px 24px",
            borderBottom: "1px solid #E8E8E8",
            backgroundColor: "#fff",
          }}>
            <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>
              {active.label}
            </h1>
            <p style={{ fontSize: "14px", color: "#717171", margin: 0 }}>{active.subtitle}</p>
          </div>

          {/* Section content */}
          <div style={{ padding: "32px" }}>
            {renderSection()}
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: "#F9F9F9", minHeight: "100vh", paddingBottom: "80px" }}>
      {verifyToast && (
        <div style={{ position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)", backgroundColor: toastColor, color: "#fff", fontSize: "13px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {verifyToast}
        </div>
      )}
      {/* Horizontal tab strip */}
      <div style={{
        backgroundColor: "#fff", borderBottom: "1px solid #E8E8E8",
        overflowX: "auto", WebkitOverflowScrolling: "touch" as unknown as undefined,
        scrollbarWidth: "none" as "none",
        display: "flex", position: "sticky", top: 0, zIndex: 20,
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                flexShrink: 0, padding: "14px 16px", border: "none",
                borderBottom: isActive ? "2px solid #C4664A" : "2px solid transparent",
                backgroundColor: "transparent", cursor: "pointer",
                fontSize: "13px", fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1B3A5C" : "#717171",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Section header */}
      <div style={{ padding: "20px 16px 12px", backgroundColor: "#fff", borderBottom: "1px solid #E8E8E8" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 4px" }}>
          {active.label}
        </h1>
        <p style={{ fontSize: "13px", color: "#717171", margin: 0 }}>{active.subtitle}</p>
      </div>

      {/* Section content */}
      <div style={{ padding: "16px" }}>
        {renderSection()}
      </div>

      {/* Mobile user + sign out footer */}
      <div style={{ padding: "20px 16px", borderTop: "1px solid #E8E8E8", marginTop: "8px", backgroundColor: "#fff" }}>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a1a", margin: "0 0 2px" }}>{fullName}</p>
        <p style={{ fontSize: "13px", color: "#717171", margin: "0 0 12px" }}>{email}</p>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#e53e3e", fontWeight: 500, padding: 0 }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
