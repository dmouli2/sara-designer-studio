import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SketchCanvas from "./SketchCanvas";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SketchCanvas", () => {
  it("shows the placeholder and no clear button when empty", () => {
    render(<SketchCanvas value={null} onChange={() => {}} />);
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
    expect(screen.queryByText("Clear sketch")).not.toBeInTheDocument();
  });

  it("restores a saved sketch onto the canvas on mount", () => {
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
    expect(screen.getByText("Clear sketch")).toBeInTheDocument();
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
    expect(screen.getByText("Clear sketch")).toBeInTheDocument();
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

  it("clears the sketch and notifies onChange(null)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<SketchCanvas value={null} onChange={onChange} />);
    const canvas = container.querySelector("canvas")!;

    fireEvent.mouseDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.mouseMove(canvas, { clientX: 2, clientY: 2 });
    fireEvent.mouseUp(canvas);

    await user.click(screen.getByText("Clear sketch"));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Draw garment sketch here")).toBeInTheDocument();
  });
});
