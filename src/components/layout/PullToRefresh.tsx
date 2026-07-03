"use client";

import { useRef, useState, useTransition, type ReactNode, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import Spinner from "./Spinner";

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;

interface PullToRefreshProps {
  children: ReactNode;
  className?: string;
}

export default function PullToRefresh({ children, className }: PullToRefreshProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragging = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  // Ties the spinner to the actual refresh round trip instead of a fixed
  // timeout — it hides when the fresh data has really rendered.
  const [refreshing, startRefresh] = useTransition();

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (refreshing || (containerRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!dragging.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPullDistance(Math.min(delta, MAX_PULL));
  }

  function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      startRefresh(() => {
        router.refresh();
      });
    }
    setPullDistance(0);
  }

  const indicatorHeight = refreshing ? 44 : pullDistance;

  return (
    <div
      ref={containerRef}
      className={className ?? "scroll-area px-4 pt-3"}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height]"
        style={{ height: indicatorHeight }}
      >
        {(refreshing || pullDistance > 10) && <Spinner size={22} />}
      </div>
      {children}
    </div>
  );
}
