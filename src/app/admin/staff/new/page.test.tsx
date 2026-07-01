import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NewStaffPage from "./page";
import { requireRole } from "@/lib/dal";

vi.mock("@/lib/dal", () => ({ requireRole: vi.fn() }));
vi.mock("@/app/actions/staff", () => ({ createStaff: vi.fn() }));

describe("NewStaffPage", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireRole).mockResolvedValue({ staffId: "a1", username: "admin", role: "admin", name: "Admin" });
  });

  it("requires an admin session and renders the create form", async () => {
    render(await NewStaffPage());
    expect(requireRole).toHaveBeenCalledWith(["admin"]);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });
});
