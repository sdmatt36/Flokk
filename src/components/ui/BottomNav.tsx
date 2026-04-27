"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bookmark, Map, User, Compass, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Trips", icon: Map, href: "/trips" },
  { label: "Saves", icon: Bookmark, href: "/saves" },
  { label: "Discover", icon: Compass, href: "/discover" },
  { label: "Travel Intel", icon: BookOpen, href: "/travel-intel" },
  { label: "Profile", icon: User, href: "/profile" },
];

export function BottomNav() {
  const pathname = usePathname();

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
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
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
