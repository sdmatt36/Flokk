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

const NAVY = "#1B3A5C";
const TERRACOTTA = "#C4664A";
const BODY_TEXT = "#374151";
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface InviteCollaboratorProps {
  inviterName: string;
  tripTitle: string;
  destinationCity: string | null;
  roleLabel: string; // e.g. "an editor" / "a viewer"
  acceptUrl: string;
}

export default function InviteCollaborator({
  inviterName,
  tripTitle,
  destinationCity,
  roleLabel,
  acceptUrl,
}: InviteCollaboratorProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${inviterName} invited you to plan ${tripTitle} on Flokk`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF8", margin: 0, padding: "32px 0", fontFamily: SANS }}>
        {/* Header */}
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: NAVY, padding: "28px 40px", textAlign: "center", borderRadius: "12px 12px 0 0" }}>
            <Text style={{ fontSize: "28px", fontWeight: 700, color: TERRACOTTA, margin: 0, letterSpacing: "-0.5px", fontFamily: SERIF }}>
              Flokk
            </Text>
          </Section>
        </Container>

        {/* Body */}
        <Container style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 40px 32px", borderRadius: "0 0 12px 12px" }}>
            <Text style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TERRACOTTA, margin: "0 0 12px" }}>
              Trip invitation
            </Text>

            <Text style={{ fontSize: "22px", lineHeight: "1.3", fontWeight: 700, color: NAVY, margin: "0 0 16px", fontFamily: SERIF }}>
              {inviterName} invited you to plan {tripTitle} on Flokk
            </Text>

            <Text style={{ fontSize: "15px", lineHeight: "1.7", color: BODY_TEXT, margin: "0 0 8px" }}>
              You have been invited to collaborate as {roleLabel} on the trip
              {destinationCity ? ` to ${destinationCity}` : ""}. Accept to see the full itinerary and
              start planning together.
            </Text>

            <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
              <Button
                href={acceptUrl}
                style={{
                  backgroundColor: TERRACOTTA,
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  textDecoration: "none",
                  padding: "13px 32px",
                  borderRadius: "999px",
                  display: "inline-block",
                }}
              >
                Accept invitation
              </Button>
            </Section>

            <Text style={{ fontSize: "13px", lineHeight: "1.6", color: "#9ca3af", margin: "16px 0 0", textAlign: "center" }}>
              Or paste this link into your browser:
              <br />
              {acceptUrl}
            </Text>

            <Hr style={{ borderColor: "#EEEEEE", margin: "28px 0 16px" }} />

            <Text style={{ fontSize: "12px", lineHeight: "1.6", color: "#9ca3af", margin: 0 }}>
              Flokk is free family travel planning. If you were not expecting this invitation, you can
              safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
