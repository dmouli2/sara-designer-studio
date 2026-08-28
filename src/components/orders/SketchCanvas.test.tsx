import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SketchCanvas from "./SketchCanvas";
import { fakeCtx } from "../../../vitest.setup";

// The shared setup reports every element as 800x480; these tests stand in a
// specific viewport instead. Restored by the afterEach below.
function stubBox(width: number, height: number) {
  return vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0,
    toJSON() {},
  } as DOMRect);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SketchCanvas", () => {
  it("shows the placeholder and disables Undo/Redo/Clear when empty", () => {
    render(<SketchCanvas value={null} onChange={() => {}} />);
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear sketch")).toBeDisabled();
    expect(screen.getByLabelText("Undo")).toBeDisabled();
    expect(screen.getByLabelText("Redo")).toBeDisabled();
  });

  it("restores a saved sketch on mount and enables Clear", () => {
    class FakeImage {
      onload: (() => void) | null = null;
      set src(_v: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    expect(() =>
      render(<SketchCanvas value="data:image/png;base64,abc" onChange={() => {}} />)
    ).not.toThrow();
    expect(screen.getByLabelText("Clear sketch")).not.toBeDisabled();
  });

  it("draws with the mouse and saves the sketch on mouse up", () => {
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    expect(screen.queryByText("Draw garment sketch here")).not.toBeInTheDocument();
    fireEvent.mouseUp(canvas);

    expect(onChange).toHaveBeenCalledWith("data:image/png;base64,mock");
    expect(screen.getByLabelText("Clear sketch")).not.toBeDisabled();
    expect(screen.getByLabelText("Undo")).not.toBeDisabled();
  });

  it("draws with touch events and saves on touch end", () => {
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.touchStart(canvas, { touches: [{ clientX: 5, clientY: 5 }] });
    fireEvent.touchMove(canvas, { touches: [{ clientX: 15, clientY: 15 }] });
    fireEvent.touchEnd(canvas);

    expect(onChange).toHaveBeenCalledWith("data:image/png;base64,mock");
  });

  it("stops drawing and saves on mouse leave", () => {
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });
    fireEvent.mouseLeave(canvas);

    expect(onChange).toHaveBeenCalledWith("data:image/png;base64,mock");
  });

  it("ignores mouse move and mouse up when not actively drawing", () => {
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
  });

  it("draws with the pen tool using source-over compositing", () => {
    const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });

    expect(fakeCtx.globalCompositeOperation).toBe("source-over");
    expect(fakeCtx.lineWidth).toBe(2.5);
  });

  it("switches to the eraser tool and draws with destination-out compositing", async () => {
    const user = userEvent.setup();
    const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
    const canvas = container.querySelector("canvas")!;

    await user.click(screen.getByLabelText("Eraser"));
    expect(screen.getByLabelText("Eraser")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Pen")).toHaveAttribute("aria-pressed", "false");

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });

    expect(fakeCtx.globalCompositeOperation).toBe("destination-out");
    expect(fakeCtx.lineWidth).toBe(20);
  });

  it("clears the sketch, notifies onChange(null), and leaves undo available", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });
    fireEvent.mouseUp(canvas);

    await user.click(screen.getByLabelText("Clear sketch"));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear sketch")).toBeDisabled();
    expect(screen.getByLabelText("Undo")).not.toBeDisabled();
  });

  it("undo steps back to the previous state and redo re-applies it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });
    fireEvent.mouseUp(canvas);
    onChange.mockClear();

    await user.click(screen.getByLabelText("Undo"));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText("Undo")).toBeDisabled();
    expect(screen.getByLabelText("Redo")).not.toBeDisabled();

    await user.click(screen.getByLabelText("Redo"));
    expect(onChange).toHaveBeenLastCalledWith("data:image/png;base64,mock");
    expect(screen.getByLabelText("Redo")).toBeDisabled();
    expect(screen.getByLabelText("Undo")).not.toBeDisabled();
  });

  it("drops redo history once a new stroke is drawn after an undo", async () => {
    const user = userEvent.setup();
    const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });
    fireEvent.mouseUp(canvas);

    await user.click(screen.getByLabelText("Undo"));
    expect(screen.getByLabelText("Redo")).not.toBeDisabled();

    fireEvent.mouseDown(canvas, { clientX: 3, clientY: 3 });
    fireEvent.mouseMove(canvas, { clientX: 4, clientY: 4 });
    fireEvent.mouseUp(canvas);

    expect(screen.getByLabelText("Redo")).toBeDisabled();
  });

  it("toggles fullscreen mode and hides the empty-state placeholder while maximized", async () => {
    const user = userEvent.setup();
    const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);

    await user.click(screen.getByLabelText("Maximize"));
    expect(container.querySelector(".fixed.inset-0")).toBeInTheDocument();
    expect(screen.queryByText("Draw garment sketch here")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Minimize")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Minimize"));
    expect(container.querySelector(".fixed.inset-0")).not.toBeInTheDocument();
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
  });

  // "Fullscreen" used to letterbox a fixed 800x480, 5:3 canvas into a band
  // across the middle of the screen — on a 390x844 phone that is a ~358x215
  // drawing area with black all around it. The bitmap now follows the box.
  describe("filling the available space", () => {
    it("sizes the backing bitmap to its box at the device pixel ratio", () => {
      stubBox(390, 784);
      vi.stubGlobal("devicePixelRatio", 2);

      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
      const canvas = container.querySelector("canvas")!;

      expect(canvas.width).toBe(780);
      expect(canvas.height).toBe(1568);
    });

    it("caps the bitmap so a large high-DPR screen can't blow the sketch payload", () => {
      stubBox(1024, 1300);
      vi.stubGlobal("devicePixelRatio", 3);

      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
      const canvas = container.querySelector("canvas")!;

      expect(Math.max(canvas.width, canvas.height)).toBe(1600);
      // …and the box's shape is kept, so nothing is stretched.
      expect(canvas.width / canvas.height).toBeCloseTo(1024 / 1300, 2);
    });

    it("keeps the canvas filling its box rather than locking it to 5:3", () => {
      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
      const canvas = container.querySelector("canvas")!;
      expect(canvas.className).toContain("w-full");
      expect(canvas.className).toContain("h-full");
      // The 5:3 window is the inline preview's box, not the canvas itself.
      expect(canvas.getAttribute("style")).toBeNull();
      expect(canvas.parentElement).toHaveStyle({ aspectRatio: "5/3" });
    });

    it("drops the 5:3 box in fullscreen so the drawing area is the whole screen", async () => {
      const user = userEvent.setup();
      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);

      await user.click(screen.getByLabelText("Maximize"));

      const box = container.querySelector("canvas")!.parentElement! as HTMLElement;
      expect(box.style.aspectRatio).toBe("");
      expect(box.className).toContain("flex-1");
      expect(box.className).not.toContain("aspect");
    });

    it("scales the pen and eraser with the bitmap so a stroke feels the same at any size", () => {
      stubBox(390, 784);
      vi.stubGlobal("devicePixelRatio", 2);
      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
      const canvas = container.querySelector("canvas")!;

      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      expect(fakeCtx.lineWidth).toBe(5); // 2.5 CSS px at 2x

      fireEvent.mouseUp(canvas);
      fireEvent.click(screen.getByLabelText("Eraser"));
      fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
      expect(fakeCtx.lineWidth).toBe(40); // 20 CSS px at 2x
    });

    it("carries the drawing across when the box changes size", () => {
      class FakeImage {
        onload: (() => void) | null = null;
        width = 716;
        height = 430;
        set src(_v: string) {
          this.onload?.();
        }
      }
      vi.stubGlobal("Image", FakeImage);
      const rect = stubBox(358, 215);
      const { container } = render(<SketchCanvas value={null} onChange={() => {}} />);
      const canvas = container.querySelector("canvas")!;
      fakeCtx.drawImage.mockClear();

      // Going fullscreen (or rotating) hands the canvas a different box.
      rect.mockReturnValue({
        width: 390, height: 784, top: 0, left: 0, right: 390, bottom: 784, x: 0, y: 0,
        toJSON() {},
      } as DOMRect);
      fireEvent(window, new Event("resize"));

      expect(canvas.width).toBe(390);
      // The old bitmap is redrawn — contained and centred, never stretched to
      // the new aspect ratio.
      expect(fakeCtx.drawImage).toHaveBeenCalledTimes(1);
      const [, dx, dy, w, h] = fakeCtx.drawImage.mock.calls[0];
      expect(w / h).toBeCloseTo(716 / 430, 2);
      expect(w).toBeLessThanOrEqual(390);
      expect(h).toBeLessThanOrEqual(784);
      expect(dx).toBeCloseTo((390 - w) / 2, 1);
      expect(dy).toBeCloseTo((784 - h) / 2, 1);
    });
  });

});
