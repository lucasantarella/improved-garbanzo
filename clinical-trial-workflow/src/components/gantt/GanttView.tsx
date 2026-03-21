"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useWorkflowStore,
  useActivitiesByLane,
  useCriticalPathIds,
} from "@/store/workflowStore";
import type { Activity, SwimLane } from "@/types";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import ActivityBar from "./ActivityBar";
import TimelineHeader from "./TimelineHeader";
import DependencyArrows from "./DependencyArrows";

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 220;
const INSERT_ZONE_HEIGHT = 12;

/** A flattened row in the virtualizer: either a lane header or an activity. */
type GanttRow =
  | { kind: "lane-header"; lane: SwimLane; activityCount: number }
  | { kind: "activity"; activity: Activity; lane: SwimLane };

/** Subtle insert indicator: a thin line with a small + button at the right */
function InsertActivityIndicator({
  top,
  onClick,
}: {
  top: number;
  onClick: () => void;
}) {
  return (
    <div
      className="absolute left-0 w-full z-20 pointer-events-none"
      style={{ top: top - 1 }}
    >
      {/* Thin colored line spanning the full width */}
      <div className="h-px w-full bg-jazz-purple/40" />
      {/* Small + icon pinned to the right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="pointer-events-auto absolute -top-2 right-1 flex items-center justify-center h-4 w-4 rounded-full border border-jazz-purple/50 bg-white text-jazz-purple hover:bg-jazz-purple hover:text-white transition-colors shadow-sm"
        title="Insert activity here"
      >
        <Plus size={10} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function GanttView() {
  const template = useWorkflowStore((s) => s.template);
  const zoomLevel = useWorkflowStore((s) => s.zoomLevel);
  const collapsedLanes = useWorkflowStore((s) => s.collapsedLanes);
  const toggleLaneCollapse = useWorkflowStore((s) => s.toggleLaneCollapse);
  const setSelectedActivity = useWorkflowStore((s) => s.setSelectedActivity);
  const insertActivityAfter = useWorkflowStore((s) => s.insertActivityAfter);
  const criticalPathFilterActive = useWorkflowStore(
    (s) => s.filters.criticalPathOnly,
  );

  const { timeConfig, swimLanes, milestones } = template;
  const activitiesByLane = useActivitiesByLane();
  const criticalIds = useCriticalPathIds();

  const columnWidth = zoomLevel === 1 ? 40 : zoomLevel === 2 ? 80 : 160;
  const totalMonths = timeConfig.rangeEnd - timeConfig.rangeStart + 1;
  const timelineWidth = totalMonths * columnWidth;

  // Track which row gap the mouse is hovering over (for the insert button)
  const [hoveredGap, setHoveredGap] = useState<{ index: number; laneId: string; afterActivityId: string } | null>(null);

  // Sort swim lanes by order
  const sortedLanes = useMemo(
    () => [...swimLanes].filter((l) => l.isVisible).sort((a, b) => a.order - b.order),
    [swimLanes],
  );

  // Build flat row list for the virtualizer
  const rows: GanttRow[] = useMemo(() => {
    const result: GanttRow[] = [];
    for (const lane of sortedLanes) {
      const laneActivities = activitiesByLane[lane.id] ?? [];
      result.push({ kind: "lane-header", lane, activityCount: laneActivities.length });
      if (!collapsedLanes.has(lane.id)) {
        for (const activity of laneActivities) {
          result.push({ kind: "activity", activity, lane });
        }
      }
    }
    return result;
  }, [sortedLanes, activitiesByLane, collapsedLanes]);

  // Build activity -> row index map (for dependency arrows)
  const activityRowMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => {
      if (row.kind === "activity") {
        map.set(row.activity.id, index);
      }
    });
    return map;
  }, [rows]);

  // All activities for dependency arrows
  const allActivities = useMemo(
    () => rows.filter((r): r is GanttRow & { kind: "activity" } => r.kind === "activity").map((r) => r.activity),
    [rows],
  );

  // Refs for synchronized scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Sync vertical scroll between label column and timeline
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    const labelEl = labelContainerRef.current;
    if (el && labelEl) {
      labelEl.scrollTop = el.scrollTop;
    }
  }, []);

  // Handle mouse move over the label column to detect row gaps
  const handleLabelMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = labelContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const y = e.clientY - rect.top + scrollTop;

      // Find the closest gap between two activity rows
      const virtualItems = rowVirtualizer.getVirtualItems();
      let closestGap: { index: number; laneId: string; afterActivityId: string; dist: number } | null = null;

      for (let i = 0; i < virtualItems.length; i++) {
        const vRow = virtualItems[i];
        const row = rows[vRow.index];
        if (!row || row.kind !== "activity") continue;

        // Check the gap at the bottom of this activity row
        const gapY = vRow.start + ROW_HEIGHT;
        const dist = Math.abs(y - gapY);

        // Only trigger within a small zone around the gap
        if (dist < INSERT_ZONE_HEIGHT) {
          // Make sure the next row is also an activity in the same lane, or this is the last activity in the lane
          const nextRow = rows[vRow.index + 1];
          const isEndOfLane = !nextRow || nextRow.kind === "lane-header";
          const isSameLane = nextRow && nextRow.kind === "activity" && nextRow.lane.id === row.lane.id;

          if (isEndOfLane || isSameLane) {
            if (!closestGap || dist < closestGap.dist) {
              closestGap = { index: vRow.index, laneId: row.lane.id, afterActivityId: row.activity.id, dist };
            }
          }
        }
      }

      if (closestGap) {
        setHoveredGap({ index: closestGap.index, laneId: closestGap.laneId, afterActivityId: closestGap.afterActivityId });
      } else {
        setHoveredGap(null);
      }
    },
    [rowVirtualizer, rows],
  );

  const handleLabelMouseLeave = useCallback(() => {
    setHoveredGap(null);
  }, []);

  // Insert a new activity after the hovered row
  const handleInsertActivity = useCallback(() => {
    if (!hoveredGap) return;
    const newId = insertActivityAfter(hoveredGap.afterActivityId, hoveredGap.laneId);
    setSelectedActivity(newId);
    setHoveredGap(null);
  }, [hoveredGap, insertActivityAfter, setSelectedActivity]);

  const totalVirtualHeight = rowVirtualizer.getTotalSize();

  // Calculate where to show the insert button
  const insertButtonTop = useMemo(() => {
    if (!hoveredGap) return null;
    const virtualItems = rowVirtualizer.getVirtualItems();
    const vRow = virtualItems.find((v) => v.index === hoveredGap.index);
    if (!vRow) return null;
    return vRow.start + ROW_HEIGHT;
  }, [hoveredGap, rowVirtualizer]);

  return (
    <div
      className="flex flex-1 h-full overflow-hidden bg-white border border-gray-200 rounded"
      onClick={() => setSelectedActivity(null)}
    >
      {/* ---- Left label column ---- */}
      <div
        className="shrink-0 border-r border-gray-200 flex flex-col"
        style={{ width: LABEL_WIDTH }}
      >
        {/* Spacer matching timeline header height */}
        <div className="h-12 border-b border-gray-200 flex items-end px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Swim Lanes
        </div>

        {/* Scrollable label area (synced with timeline) */}
        <div
          ref={labelContainerRef}
          className="flex-1 overflow-hidden relative"
          onMouseMove={handleLabelMouseMove}
          onMouseLeave={handleLabelMouseLeave}
        >
          <div style={{ height: totalVirtualHeight, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              if (row.kind === "lane-header") {
                return (
                  <div
                    key={`label-lh-${row.lane.id}`}
                    className="absolute left-0 w-full flex items-center gap-1 px-2 cursor-pointer select-none font-semibold text-xs"
                    style={{
                      height: ROW_HEIGHT,
                      top: virtualRow.start,
                      backgroundColor: `${row.lane.color}26`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLaneCollapse(row.lane.id);
                    }}
                  >
                    {collapsedLanes.has(row.lane.id) ? (
                      <ChevronRight size={14} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    )}
                    <span className="truncate" style={{ color: row.lane.color }}>
                      {row.lane.name}
                    </span>
                    <span className="text-[10px] font-normal text-gray-500 bg-white/60 rounded px-1 ml-auto">
                      {row.activityCount}
                    </span>
                  </div>
                );
              }

              // Activity label row
              return (
                <div
                  key={`label-act-${row.activity.id}`}
                  className="absolute left-0 w-full flex items-center px-3 pl-7 text-xs text-gray-700 truncate border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  style={{
                    height: ROW_HEIGHT,
                    top: virtualRow.start,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedActivity(row.activity.id);
                  }}
                >
                  <span className="truncate">{row.activity.name}</span>
                </div>
              );
            })}

            {/* Hover insert button between rows */}
            {hoveredGap && insertButtonTop !== null && (
              <InsertActivityIndicator
                top={insertButtonTop}
                onClick={handleInsertActivity}
              />
            )}
          </div>
        </div>
      </div>

      {/* ---- Right timeline area ---- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        {/* Timeline header (sticky top) */}
        <TimelineHeader
          rangeStart={timeConfig.rangeStart}
          rangeEnd={timeConfig.rangeEnd}
          columnWidth={columnWidth}
          originLabel={timeConfig.originLabel}
          milestones={milestones}
        />

        {/* Timeline body */}
        <div
          className="relative"
          style={{
            width: timelineWidth,
            height: totalVirtualHeight,
          }}
        >
          {/* Vertical grid lines */}
          {Array.from({ length: totalMonths }).map((_, i) => (
            <div
              key={`grid-${i}`}
              className="absolute top-0 h-full border-r border-dashed border-gray-100"
              style={{ left: i * columnWidth, width: 0 }}
            />
          ))}

          {/* Origin (month 0) highlight line */}
          {timeConfig.rangeStart <= 0 && timeConfig.rangeEnd >= 0 && (
            <div
              className="absolute top-0 h-full w-px bg-blue-400/40"
              style={{ left: (0 - timeConfig.rangeStart) * columnWidth }}
            />
          )}

          {/* Virtualized rows */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            if (row.kind === "lane-header") {
              return (
                <div
                  key={`tl-lh-${row.lane.id}`}
                  className="absolute left-0 w-full"
                  style={{
                    height: ROW_HEIGHT,
                    top: virtualRow.start,
                    backgroundColor: `${row.lane.color}26`,
                  }}
                />
              );
            }

            return (
              <div
                key={`tl-act-${row.activity.id}`}
                className="absolute left-0"
                style={{
                  height: ROW_HEIGHT,
                  top: virtualRow.start,
                  width: timelineWidth,
                }}
              >
                <ActivityBar
                  activity={row.activity}
                  laneColor={row.lane.color}
                  columnWidth={columnWidth}
                  rangeStart={timeConfig.rangeStart}
                  rangeEnd={timeConfig.rangeEnd}
                  criticalPathFilterActive={criticalPathFilterActive}
                  isCritical={criticalIds.has(row.activity.id)}
                />
              </div>
            );
          })}

          {/* Dependency arrows overlay */}
          <DependencyArrows
            activities={allActivities}
            columnWidth={columnWidth}
            rangeStart={timeConfig.rangeStart}
            rowHeight={ROW_HEIGHT}
            activityRowMap={activityRowMap}
            totalHeight={totalVirtualHeight}
            totalWidth={timelineWidth}
          />
        </div>
      </div>
    </div>
  );
}
