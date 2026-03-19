import Link from "next/link";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Community", href: "/community" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid #EEEEEE", backgroundColor: "#1B3A5C" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px 0" }}>

        {/* Top: wordmark + columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, auto)", gap: "48px", alignItems: "flex-start", marginBottom: "48px" }}>

          {/* Brand */}
          <div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#fff" }}>Flokk</span>
            </div>
            <p style={{ fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.8)", margin: 0 }}>
              Save it, plan it, book it, share it.
            </p>
          </div>

          {/* Columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fff", marginBottom: "16px" }}>
                {col.heading}
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", padding: "20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            © 2026 Flokk. All rights reserved.
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
