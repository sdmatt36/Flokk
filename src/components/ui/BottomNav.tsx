"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Home, Bookmark, Map, User, Compass, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/home", private: true },
  { label: "Trips", icon: Map, href: "/trips", private: true },
  { label: "Saves", icon: Bookmark, href: "/saves", private: true },
  { label: "Discover", icon: Compass, href: "/discover", private: false },
  { label: "Travel Intel", icon: BookOpen, href: "/travel-intel", private: false },
  { label: "Profile", icon: User, href: "/profile", private: true },
];

const DISCOVER_PREFIXES = ["/discover", "/cities", "/countries", "/continents", "/share", "/spots"];

function isActiveTab(href: string, pathname: string): boolean {
  if (href === "/discover") {
    return DISCOVER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
  }
  if (href === "/home") return pathname === "/home";
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "#fff",
      borderTop: "1px solid #EEEEEE",
      padding: "8px 12px",
      zIndex: 40,
    }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", display: "flex", justifyContent: "space-around" }}>
        {NAV_ITEMS.map(({ label, icon: Icon, href, private: isPrivate }) => {
          const active = isActiveTab(href, pathname);
          const effectiveHref = (isPrivate && !isSignedIn)
            ? `/sign-in?redirect_url=${encodeURIComponent(href)}`
            : href;
          return (
            <Link
              key={href}
              href={effectiveHref}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                color: active ? "#C4664A" : "#AAAAAA",
                textDecoration: "none",
                minWidth: 0,
                flex: 1,
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: "9px", fontWeight: 500, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
