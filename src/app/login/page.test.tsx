import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { login } from "@/app/actions/auth";

vi.mock("@/app/actions/auth", () => ({
  login: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a full-screen splash logo that fades out to reveal the login form", () => {
    vi.useFakeTimers();
    const { container } = render(<LoginPage />);

    expect(container.querySelectorAll('img[src*="logo-white"]')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(container.querySelectorAll('img[src*="logo-white"]')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelectorAll('img[src*="logo-white"]')).toHaveLength(1);
  });

  it("renders username and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a server-returned error after a failed submit", async () => {
    vi.mocked(login).mockResolvedValue({ error: "Invalid username or password." });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "anitha");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid username or password.")).toBeInTheDocument();
  });

  it("submits the entered credentials to the login action", async () => {
    vi.mocked(login).mockResolvedValue({});
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "anitha");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(login).mock.calls[0][1] as FormData;
    expect(formData.get("username")).toBe("anitha");
    expect(formData.get("password")).toBe("secret");
  });

  it("toggles password visibility", async () => {
    vi.mocked(login).mockResolvedValue({});
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
