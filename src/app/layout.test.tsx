import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata, viewport } from "./layout";

describe("RootLayout", () => {
  it("renders its children inside the app shell", () => {
    render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("declares an absolute-URL base and the Sara logo as the social link-preview image", () => {
    // WhatsApp only honours absolute og:image URLs — metadataBase makes the
    // relative image path resolve against the production origin.
    // metadataBase is typed `string | URL`; this app sets a URL.
    expect(new URL(metadata.metadataBase!).origin).toBe("https://sara-designer-studio.vercel.app");
    expect(metadata.openGraph?.images).toEqual([
      { url: "/icon-512.png", width: 512, height: 512, alt: "Sara Designer Studio" },
    ]);
  });

  // This app is read on a phone, in a shop, and its measurement grids run to
  // 12px. Pinning the viewport scale fails WCAG 1.4.4 and takes zoom away
  // exactly where it is most needed, so the two properties that did it must
  // not come back. `undefined` (absent) is the passing state for both.
  it("leaves pinch-zoom available", () => {
    expect(viewport.maximumScale).toBeUndefined();
    expect(viewport.userScalable).toBeUndefined();
  });

  it("still pins width and the initial scale", () => {
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.themeColor).toBe("#0F0F0F");
  });
});
