"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Milestone } from "@/types";

interface MilestoneMarkerProps {
  milestone: Milestone;
  columnWidth: number;
  rangeStart: number;
}

const GATE_COLORS: Record<string, string> = {
  approval: "#ef4444",
  review: "#f59e0b",
  informational: "#3b82f6",
};

export default function MilestoneMarker({
  milestone,
  columnWidth,
  rangeStart,
}: MilestoneMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const left =
    (milestone.month - rangeStart) * columnWidth + columnWidth / 2;
  const color = GATE_COLORS[milestone.gateType] ?? "#6b7280";
  const size = 14;

  useEffect(() => {
    if (hovered && markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 6,
      });
    }
  }, [hovered]);

  return (
    <div
      ref={markerRef}
      className="absolute"
      style={{
        left: left - size / 2,
        top: 2,
        width: size,
        height: size,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Diamond shape */}
      <div
        className="w-full h-full rotate-45 cursor-default"
        style={{
          backgroundColor: color,
          boxShadow: milestone.isCriticalPath
            ? `0 0 8px 2px ${color}66`
            : "none",
        }}
      />

      {/* Tooltip — portal to body so it's never clipped */}
      {hovered &&
        tooltipPos &&
        createPortal(
          <div
            className="fixed z-[9999] px-2.5 py-1.5 text-xs rounded-md shadow-lg bg-gray-900/95 text-white whitespace-nowrap pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold">{milestone.name}</div>
            <div className="text-gray-300 text-[11px]">
              {milestone.abbreviation} &middot; Month {milestone.month}
            </div>
            <div className="text-gray-400 text-[10px] capitalize">
              {milestone.gateType}
            </div>
            {/* Arrow pointing up */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-gray-900/95"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
