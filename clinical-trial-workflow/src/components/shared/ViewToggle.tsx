"use client";

import React from "react";
import { BarChart3, Table } from "lucide-react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { ViewMode } from "@/types";

const views: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: "gantt", label: "Gantt", icon: BarChart3 },
  { key: "table", label: "Table", icon: Table },
];

export default function ViewToggle() {
  const activeView = useWorkflowStore((s) => s.activeView);
  const setActiveView = useWorkflowStore((s) => s.setActiveView);

  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
      {views.map(({ key, label, icon: Icon }) => {
        const isActive = activeView === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActiveView(key)}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "bg-jazz-purple text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
            ].join(" ")}
            aria-pressed={isActive}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
