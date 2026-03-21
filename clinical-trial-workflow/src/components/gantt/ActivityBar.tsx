"use client";

import React, { useCallback, useRef, useState } from "react";
import type { Activity } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";
import { criticalPathClasses } from "./CriticalPathOverlay";

interface ActivityBarProps {
  activity: Activity;
  laneColor: string;
  columnWidth: number;
  rangeStart: number;
  rangeEnd: number;
  criticalPathFilterActive: boolean;
  isCritical: boolean;
}

/** Snap a value to the nearest 0.5 increment. */
function snap(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Decide text color based on a rough luminance estimate of the bg hex. */
function textColor(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length < 6) return "text-white";
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "text-gray-900" : "text-white";
}

export default function ActivityBar({
  activity,
  laneColor,
  columnWidth,
  rangeStart,
  rangeEnd,
  criticalPathFilterActive,
  isCritical,
}: ActivityBarProps) {
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);
  const setSelectedActivity = useWorkflowStore((s) => s.setSelectedActivity);
  const updateActivity = useWorkflowStore((s) => s.updateActivity);

  const isSelected = selectedActivityId === activity.id;
  const [hovered, setHovered] = useState(false);

  // -- Drag state (move) --
  const dragRef = useRef<{
    startX: number;
    origStart: number;
    type: "move" | "resize";
    origDuration: number;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ dStart: number; dDuration: number }>({
    dStart: 0,
    dDuration: 0,
  });

  const effectiveStart = activity.startMonth + dragDelta.dStart;
  const effectiveDuration = activity.isContinuous
    ? rangeEnd - effectiveStart - rangeStart + 1
    : activity.durationMonths + dragDelta.dDuration;

  const left = (effectiveStart - rangeStart) * columnWidth;
  const width = Math.max(effectiveDuration * columnWidth, 4);

  // -- Pointer handlers --
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "move" | "resize") => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        origStart: activity.startMonth,
        origDuration: activity.durationMonths,
        type,
      };
      setDragDelta({ dStart: 0, dDuration: 0 });
    },
    [activity.startMonth, activity.durationMonths],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const monthDelta = dx / columnWidth;

      if (dragRef.current.type === "move") {
        const snapped = snap(monthDelta);
        setDragDelta({ dStart: snapped, dDuration: 0 });
      } else {
        const snapped = snap(monthDelta);
        const newDuration = dragRef.current.origDuration + snapped;
        if (newDuration >= 0.5) {
          setDragDelta({ dStart: 0, dDuration: snapped });
        }
      }
    },
    [columnWidth],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      if (dragRef.current.type === "move" && dragDelta.dStart !== 0) {
        const newStart = snap(dragRef.current.origStart + dragDelta.dStart);
        updateActivity(activity.id, { startMonth: newStart });
      } else if (dragRef.current.type === "resize" && dragDelta.dDuration !== 0) {
        const newDuration = snap(
          dragRef.current.origDuration + dragDelta.dDuration,
        );
        if (newDuration >= 0.5) {
          updateActivity(activity.id, { durationMonths: newDuration });
        }
      }

      dragRef.current = null;
      setDragDelta({ dStart: 0, dDuration: 0 });
    },
    [activity.id, dragDelta, updateActivity],
  );

  const cpClasses = criticalPathClasses(
    isCritical,
    criticalPathFilterActive,
  );

  return (
    <div
      className="absolute top-[4px] flex items-center"
      style={{ left, width, height: 28 }}
    >
      {/* Main bar body -- draggable for move */}
      <div
        className={[
          "relative h-full w-full rounded-sm flex items-center overflow-hidden select-none",
          textColor(laneColor),
          isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "",
          cpClasses,
          "cursor-grab active:cursor-grabbing",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundColor: `${laneColor}b3`, // 70% opacity
          borderWidth: 2,
          borderStyle: activity.isContinuous ? "dashed" : "solid",
          borderColor: isCritical ? "#ef4444" : laneColor,
          borderRightStyle: activity.isContinuous ? "dashed" : "solid",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedActivity(activity.id);
        }}
        onPointerDown={(e) => handlePointerDown(e, "move")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Activity label */}
        <span className="text-xs font-medium px-1.5 truncate whitespace-nowrap pointer-events-none">
          {activity.name}
        </span>

        {/* Right-edge resize handle */}
        {!activity.isContinuous && (
          <div
            className="absolute right-0 top-0 h-full w-[6px] cursor-ew-resize hover:bg-white/30"
            onPointerDown={(e) => handlePointerDown(e, "resize")}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Tooltip */}
      {hovered && !dragRef.current && (
        <div
          className="absolute z-50 px-2 py-1 text-xs rounded shadow-lg bg-gray-900 text-white whitespace-nowrap pointer-events-none"
          style={{ top: 32, left: 0 }}
        >
          <div className="font-semibold">{activity.name}</div>
          <div className="text-gray-300">
            Start: {activity.startMonth} &middot; Duration:{" "}
            {activity.durationMonths}mo &middot; End: {activity.endMonth}
          </div>
          {isCritical && (
            <div className="text-red-400 text-[10px]">Critical Path</div>
          )}
        </div>
      )}
    </div>
  );
}
