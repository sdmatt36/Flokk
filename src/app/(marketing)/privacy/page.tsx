const SECTIONS = [
  {
    title: "What we collect",
    body: "We collect the information you provide when you create an account (name, email address), the links and saves you add to Flokk, your family profile details (traveler ages, interests, dietary preferences), and basic usage data (pages visited, features used). We do not collect payment information directly; that is handled by our payment processor.",
  },
  {
    title: "How we use your information",
    body: "We use your information to operate and improve Flokk, personalize your recommendations and trip suggestions, send you product updates and transactional emails you have opted into, and respond to support requests. We do not use your data for advertising purposes.",
  },
  {
    title: "What we don\u2019t do",
    body: "We do not sell your personal data to third parties. We do not show you ads. We do not share your information with data brokers or marketing platforms. We do not use tracking pixels from social media companies.",
  },
  {
    title: "Data storage and security",
    body: "Your data is stored on servers in the United States. We use industry-standard encryption for data in transit and at rest. Access to production data is restricted to essential personnel. We review our security practices regularly.",
  },
  {
    title: "Cookies",
    body: "We use essential cookies required for authentication and session management. We do not use advertising or tracking cookies. See our Cookie Policy for full details.",
  },
  {
    title: "Your rights",
    body: "You have the right to access, correct, or delete your personal data at any time. You can export your saves and trip data from your account settings. To request deletion of your account and associated data, email privacy@flokktravel.com or use the account deletion option in settings.",
  },
  {
    title: "Children\u2019s privacy",
    body: "Flokk is designed for adults planning family trips. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.",
  },
  {
    title: "Changes to this policy",
    body: "We will notify you by email and in-app notice if we make material changes to this policy. The date of the most recent revision is shown at the top of this page.",
  },
  {
    title: "Contact",
    body: "For privacy questions or data requests, contact us at privacy@flokktravel.com.",
  },
];

export default function PrivacyPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "12px" }}>Legal</p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>Privacy Policy</h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Last updated: March 2026</p>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: "0 0 48px" }}>
            Your privacy matters to us. This policy explains what information Flokk collects, how we use it, and what choices you have. We have written it in plain language on purpose.
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
