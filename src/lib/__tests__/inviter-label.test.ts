import { describe, it, expect } from "vitest";
import { inviterLabel } from "../inviter-label";

describe("inviterLabel", () => {
  it("appends Family to a bare family name", () => {
    expect(inviterLabel("Greene")).toBe("Greene Family");
  });

  it("does not double Family when the name already ends in Family", () => {
    expect(inviterLabel("Smith Family")).toBe("Smith Family");
    expect(inviterLabel("Jones family")).toBe("Jones family"); // case-insensitive
  });

  it("falls back for null / empty / whitespace", () => {
    expect(inviterLabel(null)).toBe("A Flokk family");
    expect(inviterLabel("   ")).toBe("A Flokk family");
  });
});
