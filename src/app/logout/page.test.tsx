import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import LogoutPage from "./page";
import { logoutAction } from "@/app/actions/auth";

vi.mock("@/app/actions/auth", () => ({
  logoutAction: vi.fn().mockResolvedValue(undefined),
}));

describe("LogoutPage", () => {
  beforeEach(() => {
    vi.mocked(logoutAction).mockClear();
  });

  it("calls the logout action exactly once on mount", () => {
    render(<LogoutPage />);
    expect(logoutAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Signing out…")).toBeInTheDocument();
  });

  it("still calls the logout action only once under StrictMode's double-invoked effects", () => {
    render(
      <StrictMode>
        <LogoutPage />
      </StrictMode>
    );
    expect(logoutAction).toHaveBeenCalledTimes(1);
  });
});
