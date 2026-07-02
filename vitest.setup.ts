import "@testing-library/jest-dom/vitest";
import { vi, beforeEach } from "vitest";
import React from "react";

// ---- next/navigation ---------------------------------------------------
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// ---- next/headers ---------------------------------------------------------
const cookieStoreValues = new Map<string, string>();

export const mockCookieStore = {
  get: vi.fn((name: string) => {
    const value = cookieStoreValues.get(name);
    return value === undefined ? undefined : { name, value };
  }),
  set: vi.fn((name: string, value: string) => {
    cookieStoreValues.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieStoreValues.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// ---- next/cache -------------------------------------------------------------
export const mockRevalidatePath = vi.fn();
export const mockRefresh = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
  refresh: mockRefresh,
}));

// ---- next/font/google ----------------------------------------------------
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans", className: "inter" }),
  Playfair_Display: () => ({ variable: "--font-display", className: "playfair" }),
}));

// ---- next/image ------------------------------------------------------------
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => React.createElement("img", props),
}));

// ---- Canvas 2D context (shared by SketchCanvas tests) ----------------------
// Exported (like the mocks above) so tests can assert on tool-dependent
// context properties (lineWidth, globalCompositeOperation) instead of just
// the vi.fn() call mocks.
export const fakeCtx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  drawImage: vi.fn(),
  strokeStyle: "",
  lineWidth: 0,
  lineCap: "",
  lineJoin: "",
  globalCompositeOperation: "source-over",
};

// ---- DOM-only shims (skipped under `@vitest-environment node`) -------------
// jose's webapi build fails an `instanceof Uint8Array` check across the
// jsdom vm realm, so purely server-side lib tests opt into the node
// environment via a `@vitest-environment node` file comment. Guard every
// DOM global reference here so this shared setup file still loads there.
if (typeof window !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,mock");

  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 480,
    top: 0,
    left: 0,
    right: 800,
    bottom: 480,
    x: 0,
    y: 0,
    toJSON() {},
  })) as unknown as () => DOMRect;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.forward.mockClear();
  mockRouter.refresh.mockClear();
  mockRouter.prefetch.mockClear();
  mockCookieStore.get.mockClear();
  mockCookieStore.set.mockClear();
  mockCookieStore.delete.mockClear();
  cookieStoreValues.clear();
  mockRevalidatePath.mockClear();
  mockRefresh.mockClear();
  fakeCtx.clearRect.mockClear();
  fakeCtx.beginPath.mockClear();
  fakeCtx.moveTo.mockClear();
  fakeCtx.lineTo.mockClear();
  fakeCtx.stroke.mockClear();
  fakeCtx.drawImage.mockClear();
  fakeCtx.strokeStyle = "";
  fakeCtx.lineWidth = 0;
  fakeCtx.lineCap = "";
  fakeCtx.lineJoin = "";
  fakeCtx.globalCompositeOperation = "source-over";
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});
