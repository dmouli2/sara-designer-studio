import { describe, it, expect } from "vitest";
import AdminRoot from "./page";

describe("AdminRoot", () => {
  it("redirects to /admin/orders", () => {
    expect(() => AdminRoot()).toThrow("NEXT_REDIRECT:/admin/orders");
  });
});
