import { describe, it, expect } from "vitest";
import MasterRoot from "./page";

describe("MasterRoot", () => {
  it("redirects to /master/queue", () => {
    expect(() => MasterRoot()).toThrow("NEXT_REDIRECT:/master/queue");
  });
});
