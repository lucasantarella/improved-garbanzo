"use client";

import React from "react";
import type { Milestone } from "@/types";
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

      {/* Milestone row — overflow-visible so tooltips can escape */}
      <div className="relative h-5 overflow-visible">
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
