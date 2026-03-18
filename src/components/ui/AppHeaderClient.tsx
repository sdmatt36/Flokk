"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { useClerk, UserButton } from "@clerk/nextjs";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

const NAV_ITEMS = [
  { label: "Home", href: "/home" },
  { label: "Trips", href: "/trips" },
  { label: "Saves", href: "/saves" },
  { label: "Discover", href: "/discover" },
];

function getGreeting() {
  const hour = (new Date().getUTCHours() + 9) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AppHeaderClient({
  firstName,
  fullName,
  email,
}: {
  firstName: string;
  fullName: string;
  email: string;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const [menuOpen, setMenuOpen] = useState(false);
  const greeting = getGreeting();
  const { signOut } = useClerk();

  function isActive(href: string) {
    if (href === "/home") return pathname === "/home";
    return pathname.startsWith(href);
  }

  return (
    <>
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "#fff",
        borderBottom: "1px solid #EEEEEE",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>

          {/* Left: wordmark */}
          <Link href="/home" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
              Flokk
            </span>
          </Link>

          {/* Center: desktop nav */}
          <nav style={{ display: isDesktop ? "flex" : "none", gap: "4px", alignItems: "center" }}>
            {NAV_ITEMS.map(({ label, href }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    padding: "6px 14px",
                    fontSize: "14px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#C4664A" : "#555",
                    textDecoration: "none",
                    borderBottom: active ? "2px solid #C4664A" : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right: greeting + UserButton (desktop) + hamburger (mobile) */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>

            {/* Greeting — desktop only */}
            {isDesktop && (
              <span style={{ fontSize: "13px", color: "#999" }}>
                {greeting}, {firstName}
              </span>
            )}

            {/* Clerk UserButton — handles avatar, photo, profile modal, sign out */}
            {isDesktop && (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: { width: "36px", height: "36px" },
                  },
                }}
              />
            )}

            {/* Hamburger — mobile only */}
            {!isDesktop && (
              <button
                onClick={() => setMenuOpen((v) => !v)}
                style={{ display: "flex", background: "none", border: "none", padding: "4px", cursor: "pointer", color: "#1a1a1a" }}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && !isDesktop && (
        <div
          style={{
            position: "fixed",
            top: "60px",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            zIndex: 99,
            borderTop: "1px solid #EEEEEE",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
          onClick={() => setMenuOpen(false)}
        >
          {NAV_ITEMS.map(({ label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: "14px 16px",
                  fontSize: "17px",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#C4664A" : "#1a1a1a",
                  textDecoration: "none",
                  borderRadius: "12px",
                  backgroundColor: active ? "rgba(196,102,74,0.08)" : "transparent",
                  borderLeft: active ? "3px solid #C4664A" : "3px solid transparent",
                }}
              >
                {label}
              </Link>
            );
          })}

          {/* User info + sign out at bottom of mobile drawer */}
          <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #F0F0F0" }}>
            <div style={{ padding: "0 16px 8px" }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{fullName}</p>
              <p style={{ fontSize: "12px", color: "#717171", margin: "2px 0 0" }}>{email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/" })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderRadius: "12px",
                fontSize: "16px",
                color: "#e53e3e",
                fontWeight: 500,
                background: "none",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <LogOut size={18} style={{ color: "#e53e3e" }} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
