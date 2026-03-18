const SECTIONS = [
  {
    title: "Acceptance of terms",
    body: "By creating an account or using Flokk, you agree to these Terms of Service. If you do not agree, please do not use the service. These terms constitute a binding agreement between you and Flokk.",
  },
  {
    title: "Description of service",
    body: "Flokk is a travel planning platform that helps families save, organize, and act on travel recommendations. We provide tools for saving links, building trip itineraries, and personalizing recommendations based on your family profile.",
  },
  {
    title: "Your account",
    body: "You are responsible for maintaining the security of your account credentials. You may not share your account with others or use the service for commercial purposes without our written permission. You must be at least 18 years old to create an account.",
  },
  {
    title: "Acceptable use",
    body: "You agree to use Flokk only for lawful purposes. You may not use the service to distribute spam, malware, or illegal content; impersonate others; attempt to gain unauthorized access to our systems; or interfere with other users' access to the service.",
  },
  {
    title: "Your content",
    body: "You retain ownership of the links and data you save to Flokk. By saving content, you grant us a limited license to store and process that content in order to provide the service. We do not claim ownership of your saves or trip plans.",
  },
  {
    title: "Third-party content",
    body: "Flokk extracts and displays information from third-party links (Instagram, TikTok, Google Maps, etc.). We are not responsible for the accuracy or availability of third-party content. Links to external sites are provided for convenience only.",
  },
  {
    title: "Service availability",
    body: "We aim for high availability but cannot guarantee uninterrupted service. We reserve the right to modify, suspend, or discontinue any part of the service with reasonable notice. We will always provide data export tools before a service shutdown.",
  },
  {
    title: "Limitation of liability",
    body: "Flokk is provided \u201cas is.\u201d We are not liable for indirect, incidental, or consequential damages arising from your use of the service. Our total liability to you shall not exceed the amount you paid us in the 12 months preceding the claim.",
  },
  {
    title: "Governing law",
    body: "These terms are governed by the laws of Japan. Any disputes shall be resolved in the courts of Kanagawa Prefecture, Japan.",
  },
  {
    title: "Changes to these terms",
    body: "We will notify you of material changes by email or in-app notice at least 14 days before they take effect. Continued use after that date constitutes acceptance of the updated terms.",
  },
  {
    title: "Contact",
    body: "For legal inquiries, contact us at legal@flokktravel.com.",
  },
];

export default function TermsPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "12px" }}>Legal</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>Terms of Service</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Last updated: March 2026</p>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: "0 0 48px" }}>
            Please read these terms carefully before using Flokk. They explain your rights and responsibilities when using our service.
          </p>
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
