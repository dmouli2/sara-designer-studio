import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("redirects to /login", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/login");
  });
});
