"use client";

import React, { useMemo } from "react";
import type { Activity, DependencyType } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";

interface DependencyArrowsProps {
  activities: Activity[];
  columnWidth: number;
  rangeStart: number;
  rowHeight: number;
  activityRowMap: Map<string, number>;
  totalHeight: number;
  totalWidth: number;
}

const TYPE_COLORS: Record<DependencyType, string> = {
  FS: "#3b82f6",
  SS: "#10b981",
  FF: "#8b5cf6",
  SF: "#f97316",
};

const BAR_TOP_OFFSET = 4; // top padding within a row before the bar starts
const BAR_HEIGHT = 28;

function barLeft(activity: Activity, columnWidth: number, rangeStart: number): number {
  return (activity.startMonth - rangeStart) * columnWidth;
}

function barRight(activity: Activity, columnWidth: number, rangeStart: number): number {
  return (activity.startMonth + activity.durationMonths - rangeStart) * columnWidth;
}

function rowMidY(rowIndex: number, rowHeight: number): number {
  return rowIndex * rowHeight + BAR_TOP_OFFSET + BAR_HEIGHT / 2;
}

/**
 * Build a stepped/orthogonal path for a Finish-to-Start dependency.
 * Route: exit right from predecessor end → go down (or up) → enter left to successor start.
 * Uses rounded corners via arcs for a clean look.
 */
function buildFSPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const stub = 12; // how far to extend horizontally before turning
  const r = 6;     // corner radius
  const goingDown = y2 > y1;
  const dy = Math.abs(y2 - y1);
  const dirY = goingDown ? 1 : -1;

  // If they're on the same row, just draw a straight horizontal line
  if (dy < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  const exitX = x1 + stub;
  const enterX = x2 - stub;

  // If there's enough horizontal space for a simple S-route
  if (enterX > exitX + r * 2) {
    const midX = (exitX + enterX) / 2;
    return [
      `M ${x1} ${y1}`,
      `L ${exitX} ${y1}`,
      // Corner 1: turn down/up
      `Q ${exitX + r} ${y1}, ${exitX + r} ${y1 + dirY * r}`,
      `L ${exitX + r} ${y2 - dirY * r}`,
      // Corner 2: turn toward target
      `Q ${exitX + r} ${y2}, ${exitX + r + r} ${y2}`,
      `L ${x2} ${y2}`,
    ].join(" ");
  }

  // If the successor starts before/at the predecessor end, route around:
  // exit right → go halfway down → go left → go rest of way down → enter right
  const midY = y1 + (y2 - y1) / 2;
  const loopX = Math.max(x1, x2) + stub + 8;

  return [
    `M ${x1} ${y1}`,
    `L ${x1 + stub} ${y1}`,
    // Corner: turn vertical
    `Q ${x1 + stub + r} ${y1}, ${x1 + stub + r} ${y1 + dirY * r}`,
    // Go to midpoint
    `L ${x1 + stub + r} ${midY - dirY * r}`,
    // Corner: turn toward enterX
    `Q ${x1 + stub + r} ${midY}, ${x1 + stub} ${midY}`,
    `L ${x2 - stub} ${midY}`,
    // Corner: turn vertical again
    `Q ${x2 - stub - r} ${midY}, ${x2 - stub - r} ${midY + dirY * r}`,
    `L ${x2 - stub - r} ${y2 - dirY * r}`,
    // Corner: turn toward target
    `Q ${x2 - stub - r} ${y2}, ${x2 - stub} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

/**
 * Build path for Start-to-Start: exit left from predecessor, enter left of successor.
 */
function buildSSPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const stub = 12;
  const r = 6;
  const leftX = Math.min(x1, x2) - stub;
  const goingDown = y2 > y1;
  const dirY = goingDown ? 1 : -1;

  if (Math.abs(y2 - y1) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  return [
    `M ${x1} ${y1}`,
    `L ${leftX + r} ${y1}`,
    `Q ${leftX} ${y1}, ${leftX} ${y1 + dirY * r}`,
    `L ${leftX} ${y2 - dirY * r}`,
    `Q ${leftX} ${y2}, ${leftX + r} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

/**
 * Build path for Finish-to-Finish: exit right from predecessor, enter right of successor.
 */
function buildFFPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const stub = 12;
  const r = 6;
  const rightX = Math.max(x1, x2) + stub;
  const goingDown = y2 > y1;
  const dirY = goingDown ? 1 : -1;

  if (Math.abs(y2 - y1) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  return [
    `M ${x1} ${y1}`,
    `L ${rightX - r} ${y1}`,
    `Q ${rightX} ${y1}, ${rightX} ${y1 + dirY * r}`,
    `L ${rightX} ${y2 - dirY * r}`,
    `Q ${rightX} ${y2}, ${rightX - r} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

export default function DependencyArrows({
  activities,
  columnWidth,
  rangeStart,
  rowHeight,
  activityRowMap,
  totalHeight,
  totalWidth,
}: DependencyArrowsProps) {
  const showDependencies = useWorkflowStore((s) => s.showDependencies);
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);

  const activityMap = useMemo(() => {
    const m = new Map<string, Activity>();
    for (const a of activities) m.set(a.id, a);
    return m;
  }, [activities]);

  const arrows = useMemo(() => {
    const result: {
      key: string;
      path: string;
      color: string;
      type: DependencyType;
    }[] = [];

    for (const activity of activities) {
      for (const dep of activity.dependencies) {
        const predecessor = activityMap.get(dep.predecessorId);
        if (!predecessor) continue;

        const predRow = activityRowMap.get(dep.predecessorId);
        const succRow = activityRowMap.get(activity.id);
        if (predRow === undefined || succRow === undefined) continue;

        const visible =
          showDependencies ||
          selectedActivityId === activity.id ||
          selectedActivityId === dep.predecessorId;
        if (!visible) continue;

        const y1 = rowMidY(predRow, rowHeight);
        const y2 = rowMidY(succRow, rowHeight);

        let path: string;

        switch (dep.type) {
          case "FS": {
            const x1 = barRight(predecessor, columnWidth, rangeStart);
            const x2 = barLeft(activity, columnWidth, rangeStart);
            path = buildFSPath(x1, y1, x2, y2);
            break;
          }
          case "SS": {
            const x1 = barLeft(predecessor, columnWidth, rangeStart);
            const x2 = barLeft(activity, columnWidth, rangeStart);
            path = buildSSPath(x1, y1, x2, y2);
            break;
          }
          case "FF": {
            const x1 = barRight(predecessor, columnWidth, rangeStart);
            const x2 = barRight(activity, columnWidth, rangeStart);
            path = buildFFPath(x1, y1, x2, y2);
            break;
          }
          case "SF": {
            const x1 = barLeft(predecessor, columnWidth, rangeStart);
            const x2 = barRight(activity, columnWidth, rangeStart);
            path = buildFSPath(x1, y1, x2, y2);
            break;
          }
          default: {
            const x1 = barRight(predecessor, columnWidth, rangeStart);
            const x2 = barLeft(activity, columnWidth, rangeStart);
            path = buildFSPath(x1, y1, x2, y2);
          }
        }

        result.push({
          key: `${dep.predecessorId}-${activity.id}-${dep.type}`,
          path,
          color: TYPE_COLORS[dep.type] ?? "#6b7280",
          type: dep.type,
        });
      }
    }

    return result;
  }, [
    activities,
    activityMap,
    activityRowMap,
    showDependencies,
    selectedActivityId,
    columnWidth,
    rangeStart,
    rowHeight,
  ]);

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: totalWidth, height: totalHeight }}
      aria-hidden="true"
    >
      <defs>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <marker
            key={type}
            id={`arrow-${type}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0.5 L 5 3 L 0 5.5 Z" fill={color} />
          </marker>
        ))}
      </defs>
      {arrows.map((arrow) => (
        <path
          key={arrow.key}
          d={arrow.path}
          fill="none"
          stroke={arrow.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          markerEnd={`url(#arrow-${arrow.type})`}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
