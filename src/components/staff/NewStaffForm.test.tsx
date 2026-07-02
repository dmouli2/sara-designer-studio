import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewStaffForm from "./NewStaffForm";
import { createStaff } from "@/app/actions/staff";

vi.mock("@/app/actions/staff", () => ({
  createStaff: vi.fn(),
}));

describe("NewStaffForm", () => {
  beforeEach(() => {
    vi.mocked(createStaff).mockReset();
  });

  it("renders all fields with tailor selected by default", () => {
    render(<NewStaffForm />);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toHaveValue("tailor");
  });

  it("toggles the password field between hidden and visible", async () => {
    const user = userEvent.setup();
    render(<NewStaffForm />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    await user.click(screen.getByLabelText("Show password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    await user.click(screen.getByLabelText("Hide password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("shows a server-returned error after a failed submit", async () => {
    vi.mocked(createStaff).mockResolvedValue({ error: "That username is already taken." });
    const user = userEvent.setup();
    render(<NewStaffForm />);

    await user.type(screen.getByLabelText("Full name"), "Anitha K.");
    await user.type(screen.getByLabelText("Username"), "anitha");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("That username is already taken.")).toBeInTheDocument();
  });

  it("submits the entered fields to the createStaff action", async () => {
    vi.mocked(createStaff).mockResolvedValue({});
    const user = userEvent.setup();
    render(<NewStaffForm />);

    await user.type(screen.getByLabelText("Full name"), "New Person");
    await user.type(screen.getByLabelText("Username"), "newperson");
    await user.type(screen.getByLabelText("Password"), "secret1");
    await user.selectOptions(screen.getByLabelText("Role"), "master");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("button", { name: "Create account" })).toBeInTheDocument();
    const formData = vi.mocked(createStaff).mock.calls[0][1] as FormData;
    expect(formData.get("name")).toBe("New Person");
    expect(formData.get("username")).toBe("newperson");
    expect(formData.get("password")).toBe("secret1");
    expect(formData.get("role")).toBe("master");
  });
});
