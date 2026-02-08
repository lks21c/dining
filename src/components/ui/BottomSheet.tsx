"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

const SNAP_POINTS = {
  closed: 60,
  half: 50,
  full: 90,
};

interface BottomSheetProps {
  children: ReactNode;
}

export default function BottomSheet({ children }: BottomSheetProps) {
  const [heightPercent, setHeightPercent] = useState(SNAP_POINTS.half);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = heightPercent;
  }, [heightPercent]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const deltaY = startY.current - e.touches[0].clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(
      SNAP_POINTS.full,
      Math.max(SNAP_POINTS.closed, startHeight.current + deltaPercent)
    );
    setHeightPercent(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    // Snap to nearest point
    const points = Object.values(SNAP_POINTS);
    const nearest = points.reduce((prev, curr) =>
      Math.abs(curr - heightPercent) < Math.abs(prev - heightPercent)
        ? curr
        : prev
    );
    setHeightPercent(nearest);
  }, [heightPercent]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl
        transition-[height] duration-300 ease-out z-40 flex flex-col
        md:static md:w-[380px] md:h-full md:rounded-none md:shadow-xl md:border-r border-gray-200"
      style={{ height: `${heightPercent}vh` }}
    >
      {/* Drag handle (mobile only) */}
      <div
        className="flex justify-center py-2 cursor-grab active:cursor-grabbing md:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
