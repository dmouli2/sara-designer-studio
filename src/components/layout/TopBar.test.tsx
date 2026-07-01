import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopBar from "./TopBar";

describe("TopBar", () => {
  it("renders the title without a back button or subtitle when not provided", () => {
    render(<TopBar title="Orders" />);
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<TopBar title="Orders" subtitle="5 active" />);
    expect(screen.getByText("5 active")).toBeInTheDocument();
  });

  it("renders a back button and invokes onBack when clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<TopBar title="Orders" onBack={onBack} />);
    await user.click(screen.getByRole("button"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders custom right-side content", () => {
    render(<TopBar title="Orders" right={<span>right-content</span>} />);
    expect(screen.getByText("right-content")).toBeInTheDocument();
  });

  it("renders a back link when backHref is provided without onBack", () => {
    render(<TopBar title="Staff" backHref="/admin/staff" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/admin/staff");
  });

  it("prefers onBack over backHref when both are provided", () => {
    const onBack = vi.fn();
    render(<TopBar title="Staff" onBack={onBack} backHref="/admin/staff" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
