import { describe, it, expect } from "vitest";
import { generateTicketUrl } from "../ticket-urls";

const makeEvent = (overrides: Partial<Parameters<typeof generateTicketUrl>[0]> = {}) => ({
  title: "Lotte Giants vs Samsung Lions",
  venue: "Sajik Baseball Stadium",
  startDateTime: new Date("2026-04-04T18:00:00"),
  category: "sports_events",
  ...overrides,
});

describe("generateTicketUrl", () => {
  it("sports event generates SeatGeek search URL with slugified title", () => {
    const url = generateTicketUrl(makeEvent());
    expect(url).toContain("seatgeek.com/search?search=");
    expect(url).toContain("lotte-giants-vs-samsung-lions");
  });

  it("non-sports event generates Google search URL with 'tickets' keyword", () => {
    const url = generateTicketUrl(
      makeEvent({ title: "The National", category: "live_music" })
    );
    expect(url).toContain("google.com/search?q=");
    expect(url).toContain("tickets");
    expect(url).toContain("The%20National");
  });

  it("special characters in title are encoded correctly in SeatGeek URL", () => {
    const url = generateTicketUrl(
      makeEvent({ title: "Cubs vs. Red Sox (Game 1)" })
    );
    expect(url).toContain("seatgeek.com/search?search=");
    // Slug should strip special chars: "cubs-vs-red-sox-game-1"
    expect(url).toContain("cubs-vs-red-sox-game-1");
  });

  it("null venue is handled without error", () => {
    expect(() => generateTicketUrl(makeEvent({ venue: null }))).not.toThrow();
  });

  it("Google fallback includes date in query", () => {
    const url = generateTicketUrl(
      makeEvent({ title: "Okinawa Jazz Festival", category: "seasonal_events" })
    );
    expect(url).toContain("google.com/search?q=");
    expect(url).toContain("Okinawa%20Jazz%20Festival");
    expect(url).toContain("2026");
  });
});
