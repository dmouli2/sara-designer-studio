import { describe, it, expect } from "vitest";
import TailorRoot from "./page";

describe("TailorRoot", () => {
  it("redirects to /tailor/queue", () => {
    expect(() => TailorRoot()).toThrow("NEXT_REDIRECT:/tailor/queue");
  });
});
