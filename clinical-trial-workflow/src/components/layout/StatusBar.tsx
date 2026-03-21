"use client";

import React from "react";
import { useWorkflowStore, useCriticalPathDuration } from "@/store/workflowStore";

export default function StatusBar() {
  const totalActivities = useWorkflowStore((s) => s.template.activities.length);
  const version = useWorkflowStore((s) => s.template.version);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const criticalPathMonths = useCriticalPathDuration();

  return (
    <footer className="flex h-7 items-center justify-between border-t border-gray-200 bg-white px-4 text-[11px] text-gray-400">
      <div className="flex items-center gap-4">
        <span className="tabular-nums">{totalActivities} activities</span>
        <span className="tabular-nums">
          Critical path: {criticalPathMonths} mo
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isDirty && (
          <span className="flex items-center gap-1.5 text-jazz-gold">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-jazz-gold animate-pulse" />
            Unsaved
          </span>
        )}
        <span className="text-gray-300">v{version}</span>
      </div>
    </footer>
  );
}
