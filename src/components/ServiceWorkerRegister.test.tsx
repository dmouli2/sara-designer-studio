import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

describe("ServiceWorkerRegister", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("renders nothing and skips registration outside production", () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it("registers the service worker in production when supported", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("swallows registration failures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockRejectedValue(new Error("nope"));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
    await Promise.resolve();
  });

  it("does nothing in production when serviceWorker is unsupported", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });
});
