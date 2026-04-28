// Server-side ticket URL generation.
// TheSportsDB free tier returns no ticketUrl; this constructs a search-based fallback.
//
// When affiliate wrapping is wired (SeatGeek Open API, StubHub via Impact, Ticketmaster),
// the wrapping function accepts (rawUrl, category) → affiliate-tagged URL and is inserted
// as a one-line transform here. The schema already supports this via affiliateProvider field.

export function generateTicketUrl(event: {
  title: string;
  venue: string | null;
  startDateTime: Date;
  category: string;
}): string {
  const dateString = event.startDateTime.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (event.category === "sports_events") {
    const slug = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `https://seatgeek.com/search?search=${encodeURIComponent(slug)}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(
    `${event.title} tickets ${dateString}`
  )}`;
}
