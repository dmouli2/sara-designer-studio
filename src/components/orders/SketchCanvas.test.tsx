import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SketchCanvas from "./SketchCanvas";
import { fakeCtx } from "../../../vitest.setup";

afterEach(() => {
  vi.unstubAllGlobals();
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
});
