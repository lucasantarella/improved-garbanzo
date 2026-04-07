"use client";

import React, { useCallback, useMemo } from "react";
import type { Milestone } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";
import MilestoneMarker from "./MilestoneMarker";

interface TimelineHeaderProps {
  rangeStart: number;
  rangeEnd: number;
  columnWidth: number;
  originLabel: string;
  milestones: Milestone[];
  zoomLevel: number;
}

/** Pixel threshold — milestones within this distance share a column and stack. */
const STACK_THRESHOLD_PX = 20;
/** Height of a single milestone row slot (diamond + label). */
const SLOT_HEIGHT = 22;

interface MilestoneSlot {
  milestone: Milestone;
  /** 0-based row within its stack group */
  row: number;
}

export default function TimelineHeader({
  rangeStart,
  rangeEnd,
  columnWidth,
  originLabel,
  milestones,
  zoomLevel,
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

  // Group milestones that overlap horizontally, assign stacking rows
  const { slots, maxRow } = useMemo(() => {
    if (milestones.length === 0) return { slots: [] as MilestoneSlot[], maxRow: 0 };

    // Sort by month so we can greedily assign rows
    const sorted = [...milestones].sort((a, b) => a.month - b.month);

    // Each row tracks the rightmost pixel edge occupied so far
    const rowEdges: number[] = [];
    const result: MilestoneSlot[] = [];

    for (const ms of sorted) {
      const centerPx = (ms.month - rangeStart) * columnWidth + columnWidth / 2;
      // Each marker occupies roughly STACK_THRESHOLD_PX * 2 of horizontal space
      // (label text extends to the right)
      const leftEdge = centerPx - 8;

      // Find first row where this milestone doesn't overlap
      let assignedRow = -1;
      for (let r = 0; r < rowEdges.length; r++) {
        if (leftEdge >= rowEdges[r] + STACK_THRESHOLD_PX) {
          assignedRow = r;
          break;
        }
      }
      if (assignedRow === -1) {
        assignedRow = rowEdges.length;
        rowEdges.push(0);
      }

      // Reserve space: abbreviation label can be ~50px wide from the center
      rowEdges[assignedRow] = centerPx + 50;

      result.push({ milestone: ms, row: assignedRow });
    }

    return { slots: result, maxRow: rowEdges.length };
  }, [milestones, rangeStart, columnWidth]);

  const milestoneRowHeight = Math.max(SLOT_HEIGHT, maxRow * SLOT_HEIGHT);

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

      {/* Day sub-labels row (zoom level 4 only) */}
      {zoomLevel === 4 && (
        <div className="relative h-4 flex border-t border-gray-100">
          {months.map((m) => {
            const monthLeft = (m - rangeStart) * columnWidth;
            const dayWidth = columnWidth / 30;
            return Array.from({ length: 30 }).map((_, d) => (
              <div
                key={`day-${m}-${d}`}
                className="absolute top-0 h-full flex items-center justify-center text-[8px] text-gray-400 border-r border-gray-50"
                style={{
                  left: monthLeft + d * dayWidth,
                  width: dayWidth,
                }}
              >
                {(d + 1) % 5 === 0 ? d + 1 : ""}
              </div>
            ));
          })}
        </div>
      )}

      {/* Milestone row — click to edit, double-click empty space to add */}
      <div
        className="relative overflow-visible cursor-crosshair"
        style={{ height: milestoneRowHeight }}
        onDoubleClick={handleDoubleClick}
        title="Double-click to add a milestone"
      >
        {slots.map(({ milestone: ms, row }) => (
          <MilestoneMarker
            key={ms.id}
            milestone={ms}
            columnWidth={columnWidth}
            rangeStart={rangeStart}
            row={row}
            slotHeight={SLOT_HEIGHT}
          />
        ))}
      </div>
    </div>
  );
}
