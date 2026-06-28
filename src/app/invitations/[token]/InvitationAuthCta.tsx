"use client";

import { setShareReturn } from "@/lib/share-return";

const NAVY = "#1B3A5C";
const TERRACOTTA = "#C4664A";

// Logged-out CTA. Sign-up forceRedirects to /onboarding and drops Clerk's redirect_url, so the
// flokk_share_return cookie (set on click) is what actually carries the invitee back to
// /invitations/{token} after onboarding to finish accepting. Sign-in honors redirect_url directly;
// the cookie is set there too as a belt-and-suspenders return path.
export function InvitationAuthCta({ token }: { token: string }) {
  const path = `/invitations/${token}`;
  const redirect = encodeURIComponent(path);

  return (
    <div>
      <a
        href={`/sign-up?redirect_url=${redirect}`}
        onClick={() => setShareReturn(path)}
        style={{
          display: "block",
          width: "100%",
          padding: "13px",
          borderRadius: "999px",
          backgroundColor: TERRACOTTA,
          color: "#fff",
          fontSize: "15px",
          fontWeight: 700,
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        Sign up to accept
      </a>
      <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", margin: "14px 0 0" }}>
        Already have an account?{" "}
        <a
          href={`/sign-in?redirect_url=${redirect}`}
          onClick={() => setShareReturn(path)}
          style={{ color: NAVY, textDecoration: "none", fontWeight: 600 }}
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
