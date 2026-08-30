"use client";

import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { Eraser, Pencil, Undo2, Redo2, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;          // base64 dataURL or null
  onChange: (v: string | null) => void;
}

interface HistoryState {
  stack: (string | null)[];
  index: number;
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  dark,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:active:scale-100",
        active
          ? "bg-[#C9A84C] text-[#0F0F0F]"
          : dark
          ? "bg-white/10 text-white"
          : "bg-[#F0EDE6] text-[#3A3A3C]"
      )}
    >
      {children}
    </button>
  );
}

// Pen and eraser widths are given in CSS pixels and multiplied up by the
// bitmap's pixel scale, so the stroke feels identical whether you are drawing
// in the small inline box or filling an iPad.
const PEN_WIDTH_CSS_PX = 2.5;
const ERASER_WIDTH_CSS_PX = 20;

// Caps the backing bitmap. A phone at 3x DPR would otherwise allocate a
// bitmap big enough to push the sketch PNG past the order's photo payload
// budget (MAX_PHOTO_PAYLOAD_BYTES in src/lib/image.ts).
const MAX_BITMAP_DIMENSION = 1600;

export default function SketchCanvas({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef    = useRef<HTMLDivElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  // Bitmap pixels per CSS pixel — set by the sizing effect below.
  const pixelScale = useRef(1);
  const [hasStrokes, setHasStrokes] = useState(!!value);
  const [tool, setTool]             = useState<"pen" | "eraser">("pen");
  const [fullscreen, setFullscreen] = useState(false);
  const [hist, setHist] = useState<HistoryState>({ stack: [value], index: 0 });

  // Restore saved sketch on mount
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    restoreCanvas(canvasRef.current, value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The backing bitmap follows the box the canvas is actually displayed in.
  //
  // It used to be a fixed 800x480 with the aspect ratio locked to 5:3, which
  // meant "fullscreen" letterboxed the drawing surface into a band across the
  // middle of a tall phone — most of the screen was unusable. Matching the
  // bitmap to the box makes fullscreen genuinely full on any device and any
  // orientation, and keeps one bitmap pixel square so strokes never stretch.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    function resize() {
      const el = boxRef.current;
      const c = canvasRef.current;
      if (!el || !c) return;
      const rect = el.getBoundingClientRect();
      // jsdom and a display:none parent both report 0 — nothing to size to.
      if (rect.width < 1 || rect.height < 1) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cap = Math.min(1, MAX_BITMAP_DIMENSION / (Math.max(rect.width, rect.height) * dpr));
      const scale = dpr * cap;
      const width = Math.round(rect.width * scale);
      const height = Math.round(rect.height * scale);
      if (c.width === width && c.height === height) return;

      // Resizing a canvas clears it, so carry the drawing across.
      const previous = c.width && c.height ? c.toDataURL("image/png") : null;
      c.width = width;
      c.height = height;
      pixelScale.current = scale;
      if (previous) restoreCanvas(c, previous);
    }

    resize();
    // ResizeObserver catches the fullscreen toggle and rotation; the window
    // listener is the fallback where it isn't implemented.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(box);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  // Draws a saved sketch scaled to fit inside the current bitmap, centred and
  // without distortion. Contained rather than stretched because the bitmap's
  // aspect ratio changes with the box: going fullscreen should give the
  // drawing more room around it, never squash what is already there.
  function restoreCanvas(canvas: HTMLCanvasElement, dataUrl: string | null) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const fit = Math.min(canvas.width / img.width, canvas.height / img.height) || 1;
      const w = img.width * fit;
      const h = img.height * fit;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.src = dataUrl;
  }

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function commit(dataUrl: string | null) {
    setHist((h) => {
      const stack = [...h.stack.slice(0, h.index + 1), dataUrl];
      return { stack, index: stack.length - 1 };
    });
    onChange(dataUrl);
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = ERASER_WIDTH_CSS_PX * pixelScale.current;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = PEN_WIDTH_CSS_PX * pixelScale.current;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    commit(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    commit(null);
  }

  function undo() {
    if (hist.index <= 0) return;
    const newIndex = hist.index - 1;
    const dataUrl = hist.stack[newIndex];
    if (canvasRef.current) restoreCanvas(canvasRef.current, dataUrl);
    setHist((h) => ({ ...h, index: newIndex }));
    setHasStrokes(!!dataUrl);
    onChange(dataUrl);
  }

  function redo() {
    if (hist.index >= hist.stack.length - 1) return;
    const newIndex = hist.index + 1;
    const dataUrl = hist.stack[newIndex];
    if (canvasRef.current) restoreCanvas(canvasRef.current, dataUrl);
    setHist((h) => ({ ...h, index: newIndex }));
    setHasStrokes(!!dataUrl);
    onChange(dataUrl);
  }

  const canUndo = hist.index > 0;
  const canRedo = hist.index < hist.stack.length - 1;

  // The canvas element stays in the same position in the tree across the
  // fullscreen toggle (only wrapper classNames change) — swapping between
  // two separate <canvas> elements would remount it and lose the drawing.
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-[#0F0F0F] flex flex-col pb-[env(safe-area-inset-bottom)]"
          : "space-y-2"
      }
    >
      <div className={cn("flex items-center gap-1.5 flex-wrap", fullscreen && "px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3")}>
        <ToolButton dark={fullscreen} active={tool === "pen"} onClick={() => setTool("pen")} label="Pen">
          <Pencil size={16} />
        </ToolButton>
        <ToolButton dark={fullscreen} active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
          <Eraser size={16} />
        </ToolButton>
        <div className={cn("w-px h-5 mx-0.5", fullscreen ? "bg-white/15" : "bg-[#E5E0D5]")} />
        <ToolButton dark={fullscreen} onClick={undo} disabled={!canUndo} label="Undo">
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton dark={fullscreen} onClick={redo} disabled={!canRedo} label="Redo">
          <Redo2 size={16} />
        </ToolButton>
        <div className={cn("w-px h-5 mx-0.5", fullscreen ? "bg-white/15" : "bg-[#E5E0D5]")} />
        <ToolButton dark={fullscreen} onClick={clear} disabled={!hasStrokes} label="Clear sketch">
          <Trash2 size={16} />
        </ToolButton>
        <div className="flex-1" />
        <ToolButton dark={fullscreen} onClick={() => setFullscreen((f) => !f)} label={fullscreen ? "Minimize" : "Maximize"}>
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </ToolButton>
      </div>

      {/* The canvas fills this box exactly, and the sizing effect above keeps
          the bitmap the same shape — so fullscreen is the whole screen, not a
          5:3 band floating in the middle of it. Inline keeps the compact 5:3
          preview window. */}
      <div
        ref={boxRef}
        className={
          fullscreen
            ? "flex-1 min-h-0 w-full bg-white overflow-hidden"
            : "relative rounded-2xl border-2 border-dashed border-[#E5E0D5] bg-white overflow-hidden"
        }
        style={fullscreen ? undefined : { aspectRatio: "5/3" }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className={cn(
            "touch-none block w-full h-full",
            tool === "eraser" ? "cursor-cell" : "cursor-crosshair"
          )}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasStrokes && !fullscreen && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-3xl mb-2">✏️</p>
              <p className="text-sm text-[#56524A]">Draw garment sketch here</p>
              <p className="text-xs text-[#6E5518] mt-1">Finger or stylus supported</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
