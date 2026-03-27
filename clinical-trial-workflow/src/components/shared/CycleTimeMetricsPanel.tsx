"use client";

import React, { useState } from "react";
import {
  useWorkflowStore,
  useComputedCycleTimeMetrics,
} from "@/store/workflowStore";
import type { ComputedMetric } from "@/store/workflowStore";
import { Plus, X, Pencil, Trash2, Timer } from "lucide-react";
import MetricEditor from "./MetricEditor";

function formatValue(months: number | null): {
  days: string;
  weeks: string;
  months: string;
} {
  if (months === null) {
    return { days: "-", weeks: "-", months: "-" };
  }
  const d = months * 30;
  const w = months * 4.3;
  return {
    days: `${Math.round(d)}d`,
    weeks: `${w.toFixed(1)}w`,
    months: `${months.toFixed(1)}mo`,
  };
}

function MetricCard({
  computed,
  onEdit,
  onDelete,
}: {
  computed: ComputedMetric;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { metric, months, fromActivityName, toActivityName } = computed;
  const vals = formatValue(months);
  const isNegative = months !== null && months < 0;

  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-gray-800 leading-tight">
          {metric.name}
        </h4>
        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit metric"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Delete metric"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Activity labels */}
      <div className="text-[11px] text-gray-500 mb-2 space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500 uppercase">
            {metric.fromPoint}
          </span>
          <span className="truncate" title={fromActivityName}>
            {fromActivityName}
          </span>
        </div>
        <div className="flex items-center gap-1 pl-3 text-gray-400">
          &darr;
        </div>
        <div className="flex items-center gap-1">
          <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500 uppercase">
            {metric.toPoint}
          </span>
          <span className="truncate" title={toActivityName}>
            {toActivityName}
          </span>
        </div>
      </div>

      {/* Computed values */}
      {months === null ? (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-700">
          Activity reference missing
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center">
            <div
              className={`text-sm font-bold tabular-nums ${
                isNegative ? "text-red-600" : "text-gray-900"
              }`}
            >
              {vals.days}
            </div>
            <div className="text-[10px] text-gray-400">days</div>
          </div>
          <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center">
            <div
              className={`text-sm font-bold tabular-nums ${
                isNegative ? "text-red-600" : "text-gray-900"
              }`}
            >
              {vals.weeks}
            </div>
            <div className="text-[10px] text-gray-400">weeks</div>
          </div>
          <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center">
            <div
              className={`text-sm font-bold tabular-nums ${
                isNegative ? "text-red-600" : "text-gray-900"
              }`}
            >
              {vals.months}
            </div>
            <div className="text-[10px] text-gray-400">months</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CycleTimeMetricsPanel() {
  const toggleMetricsPanel = useWorkflowStore((s) => s.toggleMetricsPanel);
  const deleteMetric = useWorkflowStore((s) => s.deleteCycleTimeMetric);
  const computedMetrics = useComputedCycleTimeMetrics();

  const [showEditor, setShowEditor] = useState(false);
  const [editingMetric, setEditingMetric] = useState<
    ComputedMetric["metric"] | undefined
  >(undefined);

  return (
    <>
      <aside className="w-[320px] shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-jazz-purple" />
            <h3 className="text-sm font-semibold text-gray-800">
              Cycle Time Metrics
            </h3>
            {computedMetrics.length > 0 && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {computedMetrics.length}
              </span>
            )}
          </div>
          <button
            onClick={toggleMetricsPanel}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close metrics panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Metrics list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {computedMetrics.length === 0 ? (
            <div className="text-center py-8">
              <Timer size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400 mb-1">No metrics yet</p>
              <p className="text-xs text-gray-400">
                Add a metric to track cycle time between two activities.
              </p>
            </div>
          ) : (
            computedMetrics.map((cm) => (
              <MetricCard
                key={cm.metric.id}
                computed={cm}
                onEdit={() => {
                  setEditingMetric(cm.metric);
                  setShowEditor(true);
                }}
                onDelete={() => deleteMetric(cm.metric.id)}
              />
            ))
          )}
        </div>

        {/* Add button */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setEditingMetric(undefined);
              setShowEditor(true);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-jazz-purple hover:text-jazz-purple"
          >
            <Plus size={14} />
            Add Metric
          </button>
        </div>
      </aside>

      {/* Editor modal */}
      {showEditor && (
        <MetricEditor
          onClose={() => {
            setShowEditor(false);
            setEditingMetric(undefined);
          }}
          existing={editingMetric}
        />
      )}
    </>
  );
}
