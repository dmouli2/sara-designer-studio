"use client";

import { useRef, useEffect, useState } from "react";
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
        "w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:active:scale-100",
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

export default function SketchCanvas({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(!!value);
  const [tool, setTool]             = useState<"pen" | "eraser">("pen");
  const [fullscreen, setFullscreen] = useState(false);
  const [hist, setHist] = useState<HistoryState>({ stack: [value], index: 0 });

  // Restore saved sketch on mount
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    restoreCanvas(canvasRef.current, value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function restoreCanvas(canvas: HTMLCanvasElement, dataUrl: string | null) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
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
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2.5;
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
    <div className={fullscreen ? "fixed inset-0 z-50 bg-[#0F0F0F] flex flex-col" : "space-y-2"}>
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

      <div
        className={
          fullscreen
            ? "flex-1 flex items-center justify-center p-4 overflow-hidden"
            : "relative rounded-2xl border-2 border-dashed border-[#E5E0D5] bg-white overflow-hidden"
        }
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className={cn(
            "touch-none",
            tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
            fullscreen ? "max-w-full max-h-full w-auto h-auto bg-white rounded-xl" : "w-full"
          )}
          style={fullscreen ? { aspectRatio: "5/3" } : { aspectRatio: "5/3" }}
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
              <p className="text-sm text-[#9A9A9A]">Draw garment sketch here</p>
              <p className="text-xs text-[#C9A84C] mt-1">Finger or stylus supported</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
