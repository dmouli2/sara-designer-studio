import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewOrderPage from "./page";
import { requireRole } from "@/lib/dal";
import { getFabrics } from "@/app/actions/fabrics";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/orders", () => ({ createOrder: vi.fn() }));
vi.mock("@/app/actions/fabrics", () => ({
  getFabrics: vi.fn(),
  createFabric: vi.fn(),
  updateFabric: vi.fn(),
  deleteFabric: vi.fn(),
}));

describe("NewOrderPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getFabrics).mockReset();
    vi.mocked(getFabrics).mockResolvedValue([{ id: "f1", name: "Silk", price: 350 }]);
  });

  it("requires an admin session, loads fabrics, and renders the wizard", async () => {
    render(await NewOrderPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getFabrics).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Choose order type")).toBeInTheDocument();
  });
});
