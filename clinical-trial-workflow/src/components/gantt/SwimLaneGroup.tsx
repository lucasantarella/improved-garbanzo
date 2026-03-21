"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Activity, SwimLane } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";
import ActivityBar from "./ActivityBar";

interface SwimLaneGroupProps {
  lane: SwimLane;
  activities: Activity[];
  columnWidth: number;
  rangeStart: number;
  rangeEnd: number;
  criticalPathFilterActive: boolean;
  criticalIds: Set<string>;
}

const ROW_HEIGHT = 36;

export default function SwimLaneGroup({
  lane,
  activities,
  columnWidth,
  rangeStart,
  rangeEnd,
  criticalPathFilterActive,
  criticalIds,
}: SwimLaneGroupProps) {
  const collapsedLanes = useWorkflowStore((s) => s.collapsedLanes);
  const toggleLaneCollapse = useWorkflowStore((s) => s.toggleLaneCollapse);
  const isCollapsed = collapsedLanes.has(lane.id);

  const totalMonths = rangeEnd - rangeStart + 1;
  const timelineWidth = totalMonths * columnWidth;

  return (
    <div>
      {/* ---- Header row ---- */}
      <div
        className="flex items-center cursor-pointer select-none"
        style={{ height: ROW_HEIGHT }}
        onClick={() => toggleLaneCollapse(lane.id)}
      >
        {/* Left label area -- rendered within the timeline so the header spans full width */}
        <div
          className="flex items-center gap-1.5 px-2 font-semibold text-xs h-full shrink-0"
          style={{
            backgroundColor: `${lane.color}26`, // 15% opacity
            minWidth: timelineWidth,
          }}
        >
          {isCollapsed ? (
            <ChevronRight size={14} className="text-gray-600 shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-gray-600 shrink-0" />
          )}
          <span className="truncate" style={{ color: lane.color }}>
            {lane.name}
          </span>
          <span className="text-[10px] font-normal text-gray-500 bg-white/60 rounded px-1">
            {activities.length}
          </span>
        </div>
      </div>

      {/* ---- Activity rows ---- */}
      {!isCollapsed &&
        activities.map((activity) => (
          <div
            key={activity.id}
            className="relative"
            style={{ height: ROW_HEIGHT, width: timelineWidth }}
          >
            {/* Grid lines behind bar */}
            {Array.from({ length: totalMonths }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-r border-dashed border-gray-100"
                style={{ left: i * columnWidth, width: columnWidth }}
              />
            ))}
            <ActivityBar
              activity={activity}
              laneColor={lane.color}
              columnWidth={columnWidth}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              criticalPathFilterActive={criticalPathFilterActive}
              isCritical={criticalIds.has(activity.id)}
            />
          </div>
        ))}
    </div>
  );
}
