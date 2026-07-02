import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewOrderPage from "./page";
import { requireRole } from "@/lib/dal";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ createOrder: vi.fn() }));

describe("NewOrderPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
  });

  it("requires an admin session and renders the wizard", async () => {
    render(await NewOrderPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(screen.getByText("Choose order type")).toBeInTheDocument();
  });
});
