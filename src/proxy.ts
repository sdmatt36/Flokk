import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  // Legacy public routes
  "/explore(.*)",
  "/destination(.*)",
  "/trip/(.*)/preview",
  // Public share view — token-gated by design; no auth required to view
  "/share/(.*)",
  "/api/webhooks(.*)",
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
