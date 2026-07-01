import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstallBanner from "./InstallBanner";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function dispatchInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const evt = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  evt.prompt = vi.fn().mockResolvedValue(undefined);
  evt.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(evt);
  });
  return evt;
}

describe("InstallBanner", () => {
  afterEach(() => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
  });

  it("renders nothing when already running in standalone mode", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(display-mode: standalone)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
    window.matchMedia = original;
  });

  it("renders nothing when the banner was already dismissed this session", () => {
    sessionStorage.setItem("install-dismissed", "1");
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows iOS install instructions on iOS Safari", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    render(<InstallBanner />);
    expect(screen.getByText("Install on iPhone")).toBeInTheDocument();
  });

  it("dismisses the iOS instructions and persists the dismissal", async () => {
    const user = userEvent.setup();
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    render(<InstallBanner />);
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Install on iPhone")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("install-dismissed")).toBe("1");
  });

  it("shows the Android install button after a beforeinstallprompt event and installs on accept", async () => {
    const user = userEvent.setup();
    render(<InstallBanner />);
    const evt = dispatchInstallPrompt("accepted");
    expect(await screen.findByText("Install App")).toBeInTheDocument();

    await user.click(screen.getByText("Install"));
    expect(evt.prompt).toHaveBeenCalled();
    expect(screen.queryByText("Install App")).not.toBeInTheDocument();
  });

  it("keeps the prompt visible when the user dismisses the native choice", async () => {
    const user = userEvent.setup();
    render(<InstallBanner />);
    dispatchInstallPrompt("dismissed");
    expect(await screen.findByText("Install App")).toBeInTheDocument();

    await user.click(screen.getByText("Install"));
    expect(screen.getByText("Install App")).toBeInTheDocument();
  });

  it("dismisses the Android banner via the close button", async () => {
    const user = userEvent.setup();
    render(<InstallBanner />);
    dispatchInstallPrompt();
    expect(await screen.findByText("Install App")).toBeInTheDocument();

    const closeBtn = screen.getAllByRole("button").find((b) => b.textContent === "");
    await user.click(closeBtn!);
    expect(screen.queryByText("Install App")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("install-dismissed")).toBe("1");
  });

  it("removes the beforeinstallprompt listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<InstallBanner />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("beforeinstallprompt", expect.any(Function));
    removeSpy.mockRestore();
  });
});
