import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

function mockServiceWorkerContainer(register: ReturnType<typeof vi.fn>) {
  const target = new EventTarget();
  return Object.assign(target, { register }) as unknown as ServiceWorkerContainer;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

describe("ServiceWorkerRegister", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "serviceWorker");
    setVisibility("visible");
  });

  it("renders nothing and skips registration outside production", () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it("registers the service worker with updateViaCache disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockServiceWorkerContainer(register),
      configurable: true,
    });

    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
  });

  it("swallows registration failures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockRejectedValue(new Error("nope"));
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockServiceWorkerContainer(register),
      configurable: true,
    });

    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
    await Promise.resolve();
  });

  it("does nothing in production when serviceWorker is unsupported", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it("checks for updates on mount, on an interval, and when the tab becomes visible again", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockServiceWorkerContainer(register),
      configurable: true,
    });

    render(<ServiceWorkerRegister />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(update).toHaveBeenCalledTimes(2);

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledTimes(3);
  });

  it("shows an updating banner and reloads exactly once when a new worker takes control", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    const swContainer = mockServiceWorkerContainer(register);
    Object.defineProperty(navigator, "serviceWorker", { value: swContainer, configurable: true });

    const { findByText } = render(<ServiceWorkerRegister />);

    await act(async () => {
      swContainer.dispatchEvent(new Event("controllerchange"));
    });
    expect(await findByText(/updating to the latest version/i)).toBeInTheDocument();
    expect(window.location.reload).toHaveBeenCalledTimes(1);

    act(() => {
      swContainer.dispatchEvent(new Event("controllerchange"));
    });
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it("stops polling and stops reacting to controller changes after unmount", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update });
    const swContainer = mockServiceWorkerContainer(register);
    Object.defineProperty(navigator, "serviceWorker", { value: swContainer, configurable: true });

    const { unmount } = render(<ServiceWorkerRegister />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledTimes(1);

    swContainer.dispatchEvent(new Event("controllerchange"));
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("ignores a registration that resolves after the component has already unmounted", async () => {
    vi.stubEnv("NODE_ENV", "production");
    let resolveRegister: (value: { update: ReturnType<typeof vi.fn> }) => void = () => {};
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn(() => new Promise((resolve) => (resolveRegister = resolve)));
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockServiceWorkerContainer(register),
      configurable: true,
    });

    const { unmount } = render(<ServiceWorkerRegister />);
    unmount();

    await act(async () => {
      resolveRegister({ update });
      await Promise.resolve();
    });
    expect(update).not.toHaveBeenCalled();
  });
});
