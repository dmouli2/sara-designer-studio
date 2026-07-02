import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditStaffForm from "./EditStaffForm";
import { updateStaff, type StaffListItem } from "@/app/actions/staff";

vi.mock("@/app/actions/staff", () => ({
  updateStaff: vi.fn(),
}));

const staff: StaffListItem = {
  id: "s1",
  username: "anitha",
  name: "Anitha K.",
  role: "tailor",
  active: true,
};

describe("EditStaffForm", () => {
  beforeEach(() => {
    vi.mocked(updateStaff).mockReset();
  });

  it("pre-fills fields from the staff record", () => {
    render(<EditStaffForm staff={staff} />);
    expect(screen.getByText("anitha")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Anitha K.");
    expect(screen.getByLabelText("Role")).toHaveValue("tailor");
    expect(screen.getByLabelText("Status")).toHaveValue("true");
  });

  it("pre-selects Deactivated status for an inactive staff record", () => {
    render(<EditStaffForm staff={{ ...staff, active: false }} />);
    expect(screen.getByLabelText("Status")).toHaveValue("false");
  });

  it("toggles the new-password field between hidden and visible", async () => {
    const user = userEvent.setup();
    render(<EditStaffForm staff={staff} />);

    const passwordInput = screen.getByLabelText("New password (leave blank to keep current)");
    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByLabelText("Show password"));
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByLabelText("Hide password"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows a server-returned error", async () => {
    vi.mocked(updateStaff).mockResolvedValue({ error: "Name is required." });
    const user = userEvent.setup();
    render(<EditStaffForm staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
  });

  it("shows a success confirmation after saving", async () => {
    vi.mocked(updateStaff).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<EditStaffForm staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("✓ Saved")).toBeInTheDocument();
  });

  it("submits the hidden id alongside edited fields", async () => {
    vi.mocked(updateStaff).mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<EditStaffForm staff={staff} />);

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Anitha Kumar");
    await user.selectOptions(screen.getByLabelText("Status"), "false");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("✓ Saved");
    const formData = vi.mocked(updateStaff).mock.calls[0][1] as FormData;
    expect(formData.get("id")).toBe("s1");
    expect(formData.get("name")).toBe("Anitha Kumar");
    expect(formData.get("active")).toBe("false");
  });
});
