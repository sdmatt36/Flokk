import { describe, it, expect } from "vitest";
import { rankRatedPicks } from "../rank-rated-picks";
import type { CommunitySpotPick } from "../rank-rated-picks";
import type { FamilyContext } from "../flokker-reason";

const ctx: FamilyContext = { childAges: [5], pace: "relaxed", interests: ["nature"] };

function makeSpot(name: string, avgRating: number): CommunitySpotPick {
  return { id: name, name, destinationCity: "Seoul", lat: 37.5, lng: 127.0, avgRating, ratingCount: 2, googlePlaceId: null, photoUrl: null };
}

describe("rankRatedPicks", () => {
  it("returns empty array for empty input", () => {
    expect(rankRatedPicks([], ctx)).toEqual([]);
  });

  it("sorts by avgRating descending", () => {
    const picks = [makeSpot("B", 3.5), makeSpot("A", 4.8), makeSpot("C", 4.1)];
    const result = rankRatedPicks(picks, ctx);
    expect(result.map(p => p.name)).toEqual(["A", "C", "B"]);
  });

  it("does not mutate original array order", () => {
    const picks = [makeSpot("X", 3.0), makeSpot("Y", 5.0)];
    rankRatedPicks(picks, ctx);
    expect(picks[0].name).toBe("X");
  });

  it("single pick passes through", () => {
    const picks = [makeSpot("Solo", 4.2)];
    expect(rankRatedPicks(picks, ctx)).toHaveLength(1);
  });
});
