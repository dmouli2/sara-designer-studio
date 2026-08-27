import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

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
});
