"use client";

import React, { useCallback } from "react";
import type { Milestone } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";
import MilestoneMarker from "./MilestoneMarker";

interface TimelineHeaderProps {
  rangeStart: number;
  rangeEnd: number;
  columnWidth: number;
  originLabel: string;
  milestones: Milestone[];
}

export default function TimelineHeader({
  rangeStart,
  rangeEnd,
  columnWidth,
  originLabel,
  milestones,
}: TimelineHeaderProps) {
  const addMilestone = useWorkflowStore((s) => s.addMilestone);
  const totalMonths = rangeEnd - rangeStart + 1;
  const totalWidth = totalMonths * columnWidth;

  const months: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m++) {
    months.push(m);
  }

  function monthLabel(month: number): string {
    if (month === 0) return originLabel;
    if (month < 0) return `${month}`;
    return `+${month}`;
  }

  // Double-click on the milestone row to add a milestone at that month
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const month = Math.round(x / columnWidth + rangeStart);
      const clampedMonth = Math.max(rangeStart, Math.min(rangeEnd, month));
      addMilestone(clampedMonth);
    },
    [columnWidth, rangeStart, rangeEnd, addMilestone],
  );

  return (
    <div
      className="sticky top-0 z-20 border-b border-gray-200 bg-white overflow-visible"
      style={{ width: totalWidth }}
    >
      {/* Month labels row */}
      <div className="relative h-7 flex">
        {months.map((m) => {
          const leftPx = (m - rangeStart) * columnWidth;
          return (
            <div
              key={m}
              className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium text-gray-500 border-r border-dashed border-gray-200"
              style={{
                left: leftPx,
                width: columnWidth,
              }}
            >
              {monthLabel(m)}
            </div>
          );
        })}
      </div>

      {/* Milestone row — click to edit, double-click empty space to add */}
      <div
        className="relative h-5 overflow-visible cursor-crosshair"
        onDoubleClick={handleDoubleClick}
        title="Double-click to add a milestone"
      >
        {milestones.map((ms) => (
          <MilestoneMarker
            key={ms.id}
            milestone={ms}
            columnWidth={columnWidth}
            rangeStart={rangeStart}
          />
        ))}
      </div>
    </div>
  );
}
