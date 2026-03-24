import Link from "next/link";

const FOOTER_COLS = [
  {
    label: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    label: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Community", href: "/community-info" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    label: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer style={{ backgroundColor: "#1B3A5C", color: "#fff" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "32px" }}>
          {/* Brand */}
          <div style={{ gridColumn: "span 1" }}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>Flokk</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", margin: "0 0 16px" }}>Save anywhere. Use here.</p>
          </div>
          {/* Columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.label}>
              <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>{col.label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href} style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: "48px", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            &copy; 2026 Flokk. All rights reserved.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="https://twitter.com" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Twitter</a>
            <a href="https://instagram.com" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Instagram</a>
            <a href="https://youtube.com" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
