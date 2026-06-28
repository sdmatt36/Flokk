import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MapPin, Calendar, Users } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { getInvitePreview } from "@/lib/invitations";
import { inviterLabel } from "@/lib/inviter-label";
import { InvitationActions } from "./InvitationActions";
import { InvitationAuthCta } from "./InvitationAuthCta";

export const dynamic = "force-dynamic";

const NAVY = "#1B3A5C";
const TERRACOTTA = "#C4664A";

function roleLabel(role: string): string {
  if (role === "EDITOR") return "an Editor";
  if (role === "VIEWER") return "a Viewer";
  return "a collaborator";
}


function formatDateRange(startIso: string | null, endIso: string | null): string | null {
  if (!startIso) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  const start = new Date(startIso).toLocaleDateString("en-US", opts);
  if (!endIso) return start;
  const end = new Date(endIso).toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${start} to ${end}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAF8" }}>
      <AppHeader />
      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "48px 24px" }}>
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #EEEEEE",
            borderRadius: "16px",
            padding: "32px 28px",
            boxShadow: "0 2px 16px rgba(27,58,92,0.06)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Same data path as GET /api/invitations/[token] (shared getInvitePreview) — no drift.
  const invite = await getInvitePreview(token);

  // ── Invalid / expired / already-accepted (token cleared on accept) ──
  if (!invite) {
    return (
      <Shell>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", color: NAVY, margin: "0 0 10px" }}>
          This invitation is no longer valid
        </h1>
        <p style={{ fontSize: "15px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>
          It may have expired, been declined, or already been accepted. If you have already joined,
          the trip is waiting in your account.
        </p>
        <Link
          href="/home"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: NAVY,
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            borderRadius: "999px",
            textDecoration: "none",
          }}
        >
          Go to your trips
        </Link>
      </Shell>
    );
  }

  const { userId } = await auth();
  const isLoggedIn = !!userId;
  const inviter = inviterLabel(invite.inviterFamilyName);
  const dateRange = formatDateRange(invite.startDate, invite.endDate);

  return (
    <Shell>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          backgroundColor: "#FFF4EE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "18px",
        }}
      >
        <Users size={22} color={TERRACOTTA} strokeWidth={2} />
      </div>

      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TERRACOTTA, margin: "0 0 10px" }}>
        Trip invitation
      </p>

      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", color: NAVY, lineHeight: 1.25, margin: "0 0 8px" }}>
        {inviter} invited you to collaborate on {invite.tripTitle}
      </h1>

      <p style={{ fontSize: "15px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 20px" }}>
        You will join as {roleLabel(invite.role)}.
      </p>

      {/* Trip context */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px", backgroundColor: "#FAFAF8", borderRadius: "12px", marginBottom: "24px" }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: NAVY }}>{invite.tripTitle}</span>
        {invite.destinationCity && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
            <MapPin size={13} color="#9ca3af" strokeWidth={2} />
            {invite.destinationCity}
          </span>
        )}
        {dateRange && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280" }}>
            <Calendar size={13} color="#9ca3af" strokeWidth={2} />
            {dateRange}
          </span>
        )}
      </div>

      {isLoggedIn ? (
        <InvitationActions token={token} tripId={invite.tripId} />
      ) : (
        <InvitationAuthCta token={token} />
      )}
    </Shell>
  );
}
