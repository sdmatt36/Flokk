import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { SHARE_RETURN_COOKIE, isSafeShareReturn } from "@/lib/share-return";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Marketing pages
  "/about(.*)",
  "/pricing(.*)",
  "/blog(.*)",
  "/help(.*)",
  "/contact(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/careers(.*)",
  "/press(.*)",
  "/community(.*)",
  "/status(.*)",
  "/cookies(.*)",
  "/accessibility(.*)",
  "/changelog(.*)",
  // Public browse surfaces
  "/cities(.*)",
  "/continents(.*)",
  "/countries(.*)",
  "/spots(.*)",
  "/share(.*)",
  "/s(.*)",
  "/discover(.*)",
  "/travel-intel(.*)",
  // Marketing pages (additional)
  "/features(.*)",
  "/how-it-works(.*)",
  "/community-info(.*)",
  // Legacy public routes
  "/explore(.*)",
  "/destination(.*)",
  "/trip/(.*)/preview",
  "/invitations(.*)",
  "/api/invitations(.*)",
  "/api/share/(.*)/preview",
  "/api/img(.*)",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/destinations(.*)",
  "/api/search(.*)",
  "/api/travel-intel(.*)",
  "/api/admin/(.*)",
  "/api/unsubscribe(.*)",
  "/api/contact(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();

    // First authenticated landing on /home: honor a pending share-return cookie so an existing
    // user who signed in from a /s (or other share) link is sent to the shared item instead of
    // /home. The existing-user sign-in path lands on /home and bypasses onboarding, which is the
    // only other place that consumes this cookie. Done in middleware (not the /home RSC) because a
    // Server Component cannot clear a cookie; here we redirect AND delete it atomically, so there
    // is no home-page flash and no re-trap on later /home visits. New-user onboarding still
    // consumes the cookie at completion and pushes to /s directly, so this never double-fires.
    if (request.nextUrl.pathname === "/home") {
      const raw = request.cookies.get(SHARE_RETURN_COOKIE)?.value;
      let path: string | null = null;
      if (raw) {
        try { path = decodeURIComponent(raw); } catch { path = null; }
      }
      if (isSafeShareReturn(path)) {
        const res = NextResponse.redirect(new URL(path, request.url));
        res.cookies.delete(SHARE_RETURN_COOKIE);
        return res;
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
