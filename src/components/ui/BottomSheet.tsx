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
  onCollapse?: () => void;
}

export default function BottomSheet({ children, expandOnContent, fullHeight, onCollapse }: BottomSheetProps) {
  const [heightPercent, setHeightPercent] = useState(SNAP_POINTS.half);
  const [dragOffset, setDragOffset] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Auto-expand when search results arrive
  useEffect(() => {
    if (expandOnContent) {
      setHeightPercent(SNAP_POINTS.full);
    }
  }, [expandOnContent]);

  // Reset drag offset when fullHeight changes
  useEffect(() => {
    setDragOffset(0);
  }, [fullHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = heightPercent;
  }, [heightPercent]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const deltaY = e.touches[0].clientY - startY.current;

    if (fullHeight) {
      // In fullHeight mode, only allow dragging down (positive deltaY)
      setDragOffset(Math.max(0, deltaY));
    } else {
      const deltaPercent = (startY.current - e.touches[0].clientY) / window.innerHeight * 100;
      const newHeight = Math.min(
        SNAP_POINTS.full,
        Math.max(SNAP_POINTS.collapsed, startHeight.current + deltaPercent)
      );
      setHeightPercent(newHeight);
    }
  }, [fullHeight]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;

    if (fullHeight) {
      // If dragged down more than 20% of viewport, collapse
      if (dragOffset > window.innerHeight * 0.2 && onCollapse) {
        onCollapse();
      }
      setDragOffset(0);
      return;
    }

    // Snap to nearest point
    const points = Object.values(SNAP_POINTS);
    const nearest = points.reduce((prev, curr) =>
      Math.abs(curr - heightPercent) < Math.abs(prev - heightPercent)
        ? curr
        : prev
    );
    setHeightPercent(nearest);
  }, [heightPercent, fullHeight, dragOffset, onCollapse]);

  const sheetStyle: React.CSSProperties = fullHeight
    ? {
        height: "100dvh",
        transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        transition: dragging.current ? "none" : "transform 0.3s ease-out",
      }
    : { height: `${heightPercent}dvh` };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl
        transition-[height] duration-300 ease-out z-40 flex flex-col will-change-[height,transform]
        md:static md:w-[380px] md:!h-full md:rounded-none md:shadow-xl md:border-r border-gray-200"
      style={sheetStyle}
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
