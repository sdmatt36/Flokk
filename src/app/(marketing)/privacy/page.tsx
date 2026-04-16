import React from "react";

const bodyStyle: React.CSSProperties = { fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: 0 };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What we collect",
    body: (
      <div style={bodyStyle}>
        <p style={{ margin: "0 0 12px" }}>When you create an account: your name and email address.</p>
        <p style={{ margin: "0 0 12px" }}>When you use Flokk: the links, places, and content you save; your family profile details (traveler ages, interests, dietary preferences, travel style); trip itineraries and activity notes you create; ratings and reviews you write; and basic usage data (features used, pages visited).</p>
        <p style={{ margin: 0 }}>When you use our email import feature: if you forward booking confirmation emails to your Flokk trip address, we process the content of those emails to extract travel details (destinations, dates, accommodation, transport) and file them into your trip. Email content is processed automatically and stored as structured trip data. We do not read your emails manually.</p>
      </div>
    ),
  },
  {
    title: "How we use your information",
    body: (
      <div style={bodyStyle}>
        <p style={{ margin: "0 0 12px" }}>We use your information to operate and improve Flokk, to personalise your trip recommendations and suggestions, to send transactional emails related to your account and trips, and to respond to support requests.</p>
        <p style={{ margin: "0 0 12px" }}>We use automated processing, including AI-assisted analysis, to extract structured data from forwarded emails and to generate personalised trip recommendations based on your family profile and travel history. You can disable AI recommendations at any time in your account settings.</p>
        <p style={{ margin: 0 }}>We do not use your data for advertising. We do not build advertising profiles.</p>
      </div>
    ),
  },
  {
    title: "Legal basis for processing (EU and UK users)",
    body: (
      <div style={bodyStyle}>
        <p style={{ margin: "0 0 12px" }}>We process your data on the following legal bases under GDPR and UK GDPR:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>Contract performance: to provide the Flokk service you have signed up for</li>
          <li>Legitimate interests: to improve the product, detect fraud, and ensure security</li>
          <li>Consent: for optional features such as sharing your trip publicly on the Discover page</li>
        </ul>
      </div>
    ),
  },
  {
    title: "Who we share your information with",
    body: (
      <div style={bodyStyle}>
        <p style={{ margin: "0 0 12px" }}>We share data only with service providers necessary to operate Flokk. These include:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>Authentication and account management providers</li>
          <li>Cloud database and infrastructure providers (servers located in the United States)</li>
          <li>Email delivery providers (for transactional and lifecycle emails)</li>
          <li>Email processing providers (for inbound email parsing)</li>
          <li>Mapping and location data providers (for map display and geocoding)</li>
          <li>AI processing providers (for recommendation and extraction features)</li>
          <li>Payment processors (if and when paid features are activated — we never see your card details)</li>
        </ul>
        <p style={{ margin: "0 0 12px" }}>All providers are contractually required to process your data only for the purposes we specify. We do not sell your data. We do not share it with data brokers or marketing platforms.</p>
        <p style={{ margin: 0 }}>Cross-border transfers: Flokk is operated from Japan. Our infrastructure providers are based in the United States. Data transfers to the US are conducted under standard contractual clauses or equivalent safeguards as required by applicable law.</p>
      </div>
    ),
  },
  {
    title: "What we don\u2019t do",
    body: "We do not sell your personal data. We do not show you ads. We do not share your data with social media companies. We do not use tracking pixels. We do not use advertising cookies.",
  },
  {
    title: "Data retention",
    body: "We retain your account data for as long as your account is active. If you delete your account, we delete your personal data within 30 days, except where we are required to retain it for legal or tax purposes. Anonymised, aggregated data (such as destination popularity statistics) may be retained indefinitely as it cannot be linked back to you.",
  },
  {
    title: "Access to your data",
    body: "Access to production data is restricted to the founding team, solely for the purpose of operating and debugging the service. We do not access individual user data except when required to investigate a reported technical issue, and only to the minimum extent necessary.",
  },
  {
    title: "Your rights",
    body: (
      <div style={bodyStyle}>
        <p style={{ margin: "0 0 12px" }}>Depending on where you live, you may have the right to:</p>
        <ul style={{ margin: "0 0 12px", paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Delete your data (right to erasure)</li>
          <li>Export your data in a portable format</li>
          <li>Restrict or object to certain types of processing</li>
          <li>Withdraw consent at any time where processing is based on consent</li>
        </ul>
        <p style={{ margin: 0 }}>To exercise any of these rights, email privacy@flokktravel.com. We will respond within 30 days. You also have the right to lodge a complaint with your local data protection authority.</p>
      </div>
    ),
  },
  {
    title: "Cookies",
    body: "We use essential cookies required for authentication and session management only. We do not use advertising or tracking cookies.",
  },
  {
    title: "Children\u2019s privacy",
    body: "Flokk is designed for adults planning family trips. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact privacy@flokktravel.com and we will delete it promptly.",
  },
  {
    title: "Changes to this policy",
    body: "We will notify you by email and in-app notice if we make material changes. The date of the most recent revision is shown at the top of this page.",
  },
  {
    title: "Contact",
    body: "For privacy questions, data requests, or complaints: privacy@flokktravel.com",
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
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Last updated: April 2026</p>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: "0 0 48px" }}>
            Your privacy matters to us. This policy explains what Flokk collects, how we use it, who we share it with, and what rights you have. Written in plain language on purpose.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "22px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 12px" }}>{section.title}</h2>
                {typeof section.body === "string" ? (
                  <p style={{ fontSize: "16px", color: "#717171", lineHeight: 1.8, margin: 0 }}>{section.body}</p>
                ) : (
                  section.body
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
