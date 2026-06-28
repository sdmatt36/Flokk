// Robust return-path store for share-driven signups.
//
// A logged-OUT viewer who taps a share CTA (trip "Steal This Itinerary", city "Add all to my
// Flokk", or an /s/ entity/tour save) is sent through /sign-up, which is hardcoded to
// forceRedirectUrl="/onboarding" and therefore DROPS Clerk's redirect_url. The onboarding
// completion handler reads this cookie and sends the new user back to the shared item instead of
// /home. A cookie survives the sign-up -> onboarding hop more reliably than the legacy 10-minute
// localStorage intent (which the /s/ path used).
//
// Browser-only (document.cookie); safe to import in client components — server calls no-op.

export const SHARE_RETURN_COOKIE = "flokk_share_return";
const MAX_AGE_SECONDS = 30 * 60; // 30 min

// Only ever return to an internal share path. Guards against an open redirect if the cookie value
// is tampered with. Allowed: the public share routes, the city-import funnel, and collaborator
// invitation accept links (/invitations/).
export function isSafeShareReturn(path: string | null | undefined): path is string {
  if (typeof path !== "string") return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return (
    path.startsWith("/share/") ||
    path.startsWith("/s/") ||
    path.startsWith("/saves/from-share") ||
    path.startsWith("/invitations/")
  );
}

// Stash the intended return path before sending a logged-out viewer to sign-up. No-op for unsafe
// paths or on the server.
export function setShareReturn(path: string): void {
  if (typeof document === "undefined") return;
  if (!isSafeShareReturn(path)) return;
  document.cookie = `${SHARE_RETURN_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

// Read AND clear the cookie. Returns the path only if it is still a safe internal share path.
export function consumeShareReturn(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${SHARE_RETURN_COOKIE}=`));
  // Always clear, even on a missing/bad value, so a stale cookie never re-fires.
  document.cookie = `${SHARE_RETURN_COOKIE}=; path=/; max-age=0; samesite=lax`;
  if (!match) return null;
  let path: string;
  try {
    path = decodeURIComponent(match.slice(SHARE_RETURN_COOKIE.length + 1));
  } catch {
    return null;
  }
  return isSafeShareReturn(path) ? path : null;
}
