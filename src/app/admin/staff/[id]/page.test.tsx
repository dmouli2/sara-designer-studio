import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EditStaffPage from "./page";
import { requireRole } from "@/lib/dal";
import { getStaffMember } from "@/app/actions/staff";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/staff", () => ({
  getStaffMember: vi.fn(),
  updateStaff: vi.fn(),
}));

describe("EditStaffPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
    vi.mocked(getStaffMember).mockReset();
  });

  it("requires an admin session and renders the edit form for a found staff member", async () => {
    vi.mocked(getStaffMember).mockResolvedValue({
      id: "s1",
      username: "anitha",
      name: "Anitha K.",
      role: "tailor",
      active: true,
    });

    render(await EditStaffPage({ params: Promise.resolve({ id: "s1" }) }));

    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(getStaffMember).toHaveBeenCalledWith("s1");
    expect(screen.getByLabelText("Full name")).toHaveValue("Anitha K.");
  });

  it("triggers a not-found response when the staff member doesn't exist", async () => {
    vi.mocked(getStaffMember).mockResolvedValue(null);
    await expect(EditStaffPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
