"use client";

import React from "react";
import type { Dependency, Activity } from "@/types";

interface DependencyChipsProps {
  dependencies: Dependency[];
  allActivities: Activity[];
}

const typeColors: Record<string, string> = {
  FS: "bg-blue-100 text-blue-700",
  SS: "bg-green-100 text-green-700",
  FF: "bg-amber-100 text-amber-700",
  SF: "bg-purple-100 text-purple-700",
};

export default function DependencyChips({
  dependencies,
  allActivities,
}: DependencyChipsProps) {
  if (dependencies.length === 0) {
    return <span className="text-[10px] text-gray-300">-</span>;
  }

  const getName = (id: string): string => {
    const act = allActivities.find((a) => a.id === id);
    return act?.name ?? "?";
  };

  // Show count badge if more than 1, with tooltip listing all
  const allTooltip = dependencies
    .map((d) => `${getName(d.predecessorId)} (${d.type})`)
    .join("\n");

  if (dependencies.length === 1) {
    const dep = dependencies[0];
    return (
      <span
        className="inline-flex items-center gap-1 max-w-full overflow-hidden"
        title={`${getName(dep.predecessorId)} (${dep.type}, lag ${dep.lagMonths})`}
      >
        <span
          className={`shrink-0 rounded px-1 py-px text-[9px] font-bold leading-none ${typeColors[dep.type] ?? "bg-gray-200 text-gray-600"}`}
        >
          {dep.type}
        </span>
        <span className="truncate text-[11px] text-gray-600">
          {getName(dep.predecessorId)}
        </span>
      </span>
    );
  }

  // Multiple dependencies: show first one + count
  const first = dependencies[0];
  return (
    <span
      className="inline-flex items-center gap-1 max-w-full overflow-hidden cursor-default"
      title={allTooltip}
    >
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] font-bold leading-none ${typeColors[first.type] ?? "bg-gray-200 text-gray-600"}`}
      >
        {first.type}
      </span>
      <span className="truncate text-[11px] text-gray-600">
        {getName(first.predecessorId)}
      </span>
      <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-px text-[9px] font-semibold text-gray-600 leading-none">
        +{dependencies.length - 1}
      </span>
    </span>
  );
}
