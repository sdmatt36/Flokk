import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

interface BetaInvitationProps {
  firstName: string;
}

const TERRACOTTA = "#C4664A";
const NAVY = "#0a1628";
const BODY_TEXT = "#374151";
const LABEL_STYLE = {
  fontSize: "11px",
  fontWeight: 700 as const,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: TERRACOTTA,
  margin: "0 0 12px",
};
const BODY_STYLE = {
  fontSize: "15px",
  lineHeight: "1.7",
  color: BODY_TEXT,
  margin: "0 0 16px",
};
const BULLET_TEXT = {
  fontSize: "15px",
  lineHeight: "1.7",
  color: BODY_TEXT,
  margin: "0 0 12px",
  paddingLeft: "0",
};

export default function BetaInvitation({ firstName }: BetaInvitationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You&apos;re invited to build Flokk with us</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", margin: 0, padding: "32px 0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* Header */}
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: NAVY, padding: "28px 40px", textAlign: "center", borderRadius: "12px 12px 0 0" }}>
            <Text style={{ fontSize: "28px", fontWeight: 700, color: TERRACOTTA, margin: 0, letterSpacing: "-0.5px" }}>
              Flokk
            </Text>
          </Section>
        </Container>

        {/* Body */}
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 40px 32px", borderRadius: "0 0 12px 12px" }}>

            {/* Greeting */}
            <Text style={BODY_STYLE}>Hi {firstName},</Text>

            {/* Opening copy */}
            <Text style={BODY_STYLE}>
              You know the drill. A folder in Instagram with 200 saved places you&apos;ll never find again. A booking confirmation buried in your inbox. A spreadsheet your partner made that&apos;s already out of date. Four tabs open, two kids asking questions, and somehow you&apos;re still not sure if the hotel has a pool.
            </Text>
            <Text style={{ ...BODY_STYLE, marginBottom: "28px" }}>
              We built Flokk to fix that. It&apos;s a family travel platform that connects the dots from the moment you save something anywhere to the day you check out of your hotel.
            </Text>

            <Hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0 0 28px" }} />

            {/* Section 1 — What Flokk does right now */}
            <Text style={LABEL_STYLE}>What Flokk does right now</Text>
            <Section style={{ backgroundColor: "#faf9f7", borderRadius: "10px", padding: "20px 24px", marginBottom: "28px" }}>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Save directly to a trip from anywhere.</strong> Instagram, TikTok, Airbnb, Booking.com, or anywhere you save travel info. Instead of saves disappearing into folders you&apos;ll never open, drop them straight into the trip you&apos;re planning.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Forward a booking and watch it file itself.</strong> Send any hotel, flight, or train confirmation to trips@flokktravel.com and Flokk reads it, extracts every detail, and drops it into the right day of your itinerary automatically.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Your trip, fully organized.</strong> Itinerary, vault of confirmations, saved places, and a running budget all in one place, built around how families actually travel.
              </Text>
              <Text style={{ ...BULLET_TEXT, margin: 0 }}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Trip Intelligence.</strong> Flokk tells you what you&apos;ve booked, what&apos;s still missing, and how much time you have to sort it so nothing slips through the cracks before you leave.
              </Text>
            </Section>

            {/* Section 2 — What's coming */}
            <Text style={LABEL_STYLE}>What&apos;s coming and where you come in</Text>
            <Section style={{ backgroundColor: "#f0f4ff", borderLeft: "3px solid #3b82f6", borderRadius: "0 10px 10px 0", padding: "20px 24px", marginBottom: "28px" }}>
              <Text style={BULLET_TEXT}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Book flights and hotels inside Flokk.</strong> Search, compare, and book without leaving the app with your family&apos;s ages, preferences, and past trips already factored in.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Mobile app, coming within a month or two of your feedback.</strong> Save from Instagram, TikTok, Airbnb, and Booking.com directly into Flokk with a single tap from the share sheet. No more folders. No more lost saves.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Camera roll import by date range.</strong> Pick a date range, point Flokk at your camera roll, and it maps every trip from that period automatically using photo location data, combined with anything you&apos;ve already added. Your travel history, finally organized.
              </Text>
              <Text style={{ ...BULLET_TEXT, margin: 0 }}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>A sizable roadmap beyond that.</strong> We&apos;re building fast and your feedback shapes what gets prioritized. You&apos;re not just a beta user. You&apos;re on the team.
              </Text>
            </Section>

            {/* Section 3 — How to explore it */}
            <Text style={LABEL_STYLE}>How to explore it</Text>
            <Section style={{ backgroundColor: "#fdf8f6", borderLeft: `3px solid ${TERRACOTTA}`, borderRadius: "0 10px 10px 0", padding: "20px 24px", marginBottom: "28px" }}>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Step 1:</strong> Go to flokktravel.com, have a look around, then sign up and go through onboarding. That&apos;s your starting point.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Step 2:</strong> Read through the site. Take your time. Go through every page and check the footer links. There&apos;s more in there than you&apos;d expect.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Step 3:</strong> Add a trip or five. Start somewhere you&apos;re already planning or a trip you&apos;ve done before. It all works. Mostly. Hopefully.
              </Text>
              <Text style={BULLET_TEXT}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Step 4:</strong> Forward a booking confirmation to trips@flokktravel.com from your account email. Watch it auto-file into your trip. That&apos;s the moment.
              </Text>
              <Text style={{ ...BULLET_TEXT, margin: 0 }}>
                <span style={{ color: TERRACOTTA, fontWeight: 700 }}>·</span>{" "}
                <strong style={{ color: NAVY }}>Step 5:</strong> Tell us honestly what&apos;s missing, what&apos;s confusing, and what you wish it did. That&apos;s the whole point of this.
              </Text>
            </Section>

            {/* Personal note */}
            <Section style={{ backgroundColor: "#faf9f7", borderLeft: `3px solid ${TERRACOTTA}`, borderRadius: "0 10px 10px 0", padding: "20px 24px", marginBottom: "32px" }}>
              <Text style={{ ...BODY_STYLE, fontStyle: "italic", margin: 0 }}>
                I know we&apos;re all in the middle of packing, moving, traveling. That&apos;s just life right now. There&apos;s absolutely no rush on this. But Jen and I genuinely value your friendship and your honesty, and we&apos;d love to know what you think when you get a moment. We think we&apos;re onto something real here, and having people we trust in it early means everything.
              </Text>
            </Section>

            {/* CTA */}
            <Section style={{ textAlign: "center", marginBottom: "32px" }}>
              <Button
                href="https://flokktravel.com"
                style={{
                  backgroundColor: TERRACOTTA,
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "14px 36px",
                  borderRadius: "999px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Join the beta
              </Button>
            </Section>

            {/* Signature */}
            <Text style={{ ...BODY_STYLE, margin: "0 0 4px" }}>
              Matt Greene &amp; Jenifer Dasho
            </Text>
            <Text style={{ ...BODY_STYLE, color: "#6b7280", marginBottom: "28px" }}>
              Co-Founders, Flokk
            </Text>

            <Hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0 0 24px" }} />

            {/* P.S. */}
            <Text style={{ ...BODY_STYLE, marginBottom: "16px" }}>
              <strong style={{ color: NAVY }}>P.S.</strong> Real, relevant content is the backbone of what makes Flokk valuable for every family that comes after you. The trips you add, the places you save, the past travels you import. That content is the moat. We know it takes a little time and we don&apos;t take that lightly.
            </Text>
            <Text style={{ ...BODY_STYLE, margin: 0 }}>
              And one more thing. Depending on the level of contribution made before we open Flokk to the wider world, we&apos;re exploring an avenue for equity participation for founding contributors. Nothing to commit to now. But we wanted you to know that&apos;s on the table. The people who help build this deserve to share in what it becomes.
            </Text>

          </Section>
        </Container>

        {/* Footer */}
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: "#f8fafc", padding: "20px 40px", textAlign: "center", borderRadius: "0 0 8px 8px" }}>
            <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0, lineHeight: "1.6" }}>
              Flokk &middot; flokktravel.com &middot; You&apos;re receiving this because Matt &amp; Jen invited you personally.
            </Text>
          </Section>
        </Container>

      </Body>
    </Html>
  );
}
