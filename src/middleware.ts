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
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/destinations(.*)",
  "/api/search(.*)",
  "/api/travel-intel(.*)",
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
