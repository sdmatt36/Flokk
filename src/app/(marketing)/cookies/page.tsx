const COOKIE_TYPES = [
  {
    name: "Essential cookies",
    required: true,
    description: "These cookies are required for the service to function. They manage your authentication session and remember your login state. You cannot opt out of essential cookies while using Flokk.",
    examples: ["__session (authentication)", "clerk.token (user session)"],
  },
  {
    name: "Preference cookies",
    required: false,
    description: "These cookies remember your settings and preferences, such as your selected theme or last-visited trip. They are not required but improve your experience.",
    examples: ["flokk.prefs (user preferences)"],
  },
  {
    name: "Analytics cookies",
    required: false,
    description: "We use privacy-first analytics to understand how features are used and identify areas for improvement. No personal data is shared with third parties. Analytics can be disabled in account settings.",
    examples: ["flokk.analytics (anonymous usage)"],
  },
];

const SECTIONS = [
  {
    title: "What are cookies?",
    body: "Cookies are small text files stored on your device when you visit a website. They help websites remember information about your visit, like your login state or preferences.",
  },
  {
    title: "How to control cookies",
    body: "You can control cookies through your browser settings. Most browsers allow you to block, delete, or be notified about cookies. Note that blocking essential cookies will prevent you from using Flokk. You can also manage analytics preferences in your account settings.",
  },
  {
    title: "Third-party cookies",
    body: "Flokk does not use advertising cookies or tracking pixels from social media companies. We do not embed third-party ad scripts on our pages.",
  },
  {
    title: "Changes to this policy",
    body: "We will notify you of material changes to this cookie policy. The date of the most recent revision is shown at the top of this page.",
  },
  {
    title: "Contact",
    body: "For questions about cookies, email privacy@flokktravel.com.",
  },
];

export default function CookiesPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "12px" }}>Legal</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>Cookie Policy</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Last updated: March 2026</p>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: "0 0 48px" }}>
            Flokk uses a small number of cookies. We use them only when necessary and we don't use advertising cookies. Here's what we use and why.
          </p>

          {/* Cookie types */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "56px" }}>
            {COOKIE_TYPES.map((ct) => (
              <div key={ct.name} style={{ border: "1px solid #F0F0F0", borderRadius: "16px", padding: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>{ct.name}</h2>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: ct.required ? "rgba(27,58,92,0.1)" : "rgba(196,102,74,0.1)", color: ct.required ? "#1B3A5C" : "#C4664A", padding: "4px 10px", borderRadius: "999px" }}>
                    {ct.required ? "Required" : "Optional"}
                  </span>
                </div>
                <p style={{ fontSize: "15px", color: "#717171", lineHeight: 1.7, margin: "0 0 16px" }}>{ct.description}</p>
                <div style={{ backgroundColor: "#F9F9F9", borderRadius: "8px", padding: "12px 16px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Examples</p>
                  {ct.examples.map((ex) => (
                    <p key={ex} style={{ fontSize: "13px", color: "#555", fontFamily: "monospace", margin: "0 0 4px" }}>{ex}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Other sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>{section.title}</h2>
                <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: 0 }}>{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
