import { describe, it, expect, vi } from "vitest";
import { UserFacingError, isUserFacingError, userMessageFor } from "./errors";

describe("UserFacingError", () => {
  it("is an Error carrying its message and a stable name", () => {
    const err = new UserFacingError("Retake the photo with better light.");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Retake the photo with better light.");
    expect(err.name).toBe("UserFacingError");
  });
});

describe("isUserFacingError", () => {
  it("recognises a UserFacingError", () => {
    expect(isUserFacingError(new UserFacingError("nope"))).toBe(true);
  });

  it("recognises one from another module instance by name, not prototype", () => {
    // A bundled copy of the class fails `instanceof` across module boundaries.
    const cloned = Object.assign(new Error("nope"), { name: "UserFacingError" });
    expect(isUserFacingError(cloned)).toBe(true);
  });

  it("rejects plain errors and non-errors", () => {
    expect(isUserFacingError(new Error("boom"))).toBe(false);
    expect(isUserFacingError(new TypeError("boom"))).toBe(false);
    expect(isUserFacingError("boom")).toBe(false);
    expect(isUserFacingError(null)).toBe(false);
    expect(isUserFacingError(undefined)).toBe(false);
  });
});

describe("userMessageFor", () => {
  it("passes a user-facing message straight through and logs nothing", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(userMessageFor(new UserFacingError("Quota is busy."), "fallback")).toBe("Quota is busy.");
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("replaces an internal error's message with the fallback and logs it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const internal = new Error("postgres: FATAL password authentication failed");

    expect(userMessageFor(internal, "Something went wrong.")).toBe("Something went wrong.");

    expect(consoleError).toHaveBeenCalledWith(internal);
    consoleError.mockRestore();
  });

  it("uses the fallback for a thrown non-Error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(userMessageFor("boom", "Something went wrong.")).toBe("Something went wrong.");
    consoleError.mockRestore();
  });
});
