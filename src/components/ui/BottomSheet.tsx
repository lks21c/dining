"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";

const SNAP_POINTS = {
  collapsed: 10,
  half: 42,
  full: 92,
};

interface BottomSheetProps {
  children: ReactNode;
  expandOnContent?: boolean;
  fullHeight?: boolean;
}

export default function BottomSheet({ children, expandOnContent, fullHeight }: BottomSheetProps) {
  const [heightPercent, setHeightPercent] = useState(SNAP_POINTS.half);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Auto-expand when search results arrive
  useEffect(() => {
    if (expandOnContent) {
      setHeightPercent(SNAP_POINTS.full);
    }
  }, [expandOnContent]);

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
      Math.max(SNAP_POINTS.collapsed, startHeight.current + deltaPercent)
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
        transition-[height] duration-300 ease-out z-40 flex flex-col will-change-[height]
        md:static md:w-[380px] md:!h-full md:rounded-none md:shadow-xl md:border-r border-gray-200"
      style={{ height: fullHeight ? "100dvh" : `${heightPercent}dvh` }}
    >
      {/* Drag handle (mobile only) */}
      <div
        className="flex justify-center items-center min-h-[44px] cursor-grab active:cursor-grabbing md:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col pb-safe">{children}</div>
    </div>
  );
}
