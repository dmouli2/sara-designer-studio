import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StaffListPage from "./page";
import { requireRole } from "@/lib/dal";
import { listStaff } from "@/app/actions/staff";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/staff", () => ({ listStaff: vi.fn() }));

describe("StaffListPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(listStaff).mockReset();
  });

  it("requires an admin session", async () => {
    vi.mocked(listStaff).mockResolvedValue([]);
    render(await StaffListPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
  });

  it("shows a back link to the orders list", async () => {
    vi.mocked(listStaff).mockResolvedValue([]);
    const { container } = render(await StaffListPage());
    expect(container.querySelector(".rounded-full")).toHaveAttribute("href", "/admin/orders");
  });

  it("shows an empty state with no staff", async () => {
    vi.mocked(listStaff).mockResolvedValue([]);
    render(await StaffListPage());
    expect(screen.getByText("No staff accounts yet")).toBeInTheDocument();
  });

  it("lists staff accounts and flags deactivated ones", async () => {
    vi.mocked(listStaff).mockResolvedValue([
      { id: "s1", username: "anitha", name: "Anitha K.", role: "tailor", active: true },
      { id: "s2", username: "suresh", name: "Suresh M.", role: "master", active: false },
    ]);
    render(await StaffListPage());

    expect(screen.getByText("Anitha K.")).toBeInTheDocument();
    expect(screen.getByText("@anitha · Tailor")).toBeInTheDocument();
    expect(screen.getByText("Suresh M.")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deactivated")).toBeInTheDocument();
  });
});
