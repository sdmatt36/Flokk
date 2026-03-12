"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bookmark, Map, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Saves", icon: Bookmark, href: "/saves" },
  { label: "Trips", icon: Map, href: "/trips" },
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
      padding: "12px 32px",
      zIndex: 80,
    }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", display: "flex", justifyContent: "space-around" }}>
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href || (href === "/trips" && pathname.startsWith("/trips"));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                color: active ? "#C4664A" : "#AAAAAA",
                textDecoration: "none",
              }}
            >
              <Icon size={22} />
              <span style={{ fontSize: "11px", fontWeight: 500 }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
