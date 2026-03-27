"use client";

import React, { useState, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { MetricPointType, CycleTimeMetric } from "@/types";
import Modal from "@/components/ui/Modal";
import { Search } from "lucide-react";

interface MetricEditorProps {
  onClose: () => void;
  /** If provided, we're editing an existing metric. */
  existing?: CycleTimeMetric;
}

const POINT_OPTIONS: { value: MetricPointType; label: string }[] = [
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
];

export default function MetricEditor({ onClose, existing }: MetricEditorProps) {
  const activities = useWorkflowStore((s) => s.template.activities);
  const swimLanes = useWorkflowStore((s) => s.template.swimLanes);
  const addMetric = useWorkflowStore((s) => s.addCycleTimeMetric);
  const updateMetric = useWorkflowStore((s) => s.updateCycleTimeMetric);

  const laneMap = useMemo(() => {
    const map = new Map<string, { name: string; shortName: string; color: string }>();
    for (const l of swimLanes) map.set(l.id, { name: l.name, shortName: l.shortName, color: l.color });
    return map;
  }, [swimLanes]);

  const [name, setName] = useState(existing?.name ?? "");
  const [fromId, setFromId] = useState<string | null>(
    existing?.fromActivityId ?? null,
  );
  const [fromPoint, setFromPoint] = useState<MetricPointType>(
    existing?.fromPoint ?? "end",
  );
  const [toId, setToId] = useState<string | null>(
    existing?.toActivityId ?? null,
  );
  const [toPoint, setToPoint] = useState<MetricPointType>(
    existing?.toPoint ?? "start",
  );
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredFrom = useMemo(() => {
    const q = fromSearch.toLowerCase();
    return q
      ? activities.filter((a) => a.name.toLowerCase().includes(q))
      : activities;
  }, [activities, fromSearch]);

  const filteredTo = useMemo(() => {
    const q = toSearch.toLowerCase();
    return q
      ? activities.filter((a) => a.name.toLowerCase().includes(q))
      : activities;
  }, [activities, toSearch]);

  const fromName = activities.find((a) => a.id === fromId)?.name;
  const toName = activities.find((a) => a.id === toId)?.name;

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a metric name.");
      return;
    }
    if (!fromId) {
      setError("Select a 'From' activity.");
      return;
    }
    if (!toId) {
      setError("Select a 'To' activity.");
      return;
    }

    if (existing) {
      updateMetric(existing.id, {
        name: trimmedName,
        fromActivityId: fromId,
        fromPoint,
        toActivityId: toId,
        toPoint,
      });
    } else {
      addMetric({
        name: trimmedName,
        fromActivityId: fromId,
        fromPoint,
        toActivityId: toId,
        toPoint,
      });
    }
    onClose();
  }

  return (
    <Modal title={existing ? "Edit Metric" : "New Cycle Time Metric"} onClose={onClose}>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metric Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g. IND to FPD"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* From activity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From Activity
          </label>
          <div className="flex gap-2 mb-1">
            {POINT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFromPoint(opt.value)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  fromPoint === opt.value
                    ? "border-jazz-purple bg-jazz-purple/10 text-jazz-purple"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search activities..."
              value={fromSearch}
              onChange={(e) => setFromSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white">
            {filteredFrom.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">No results</p>
            )}
            {filteredFrom.map((a) => {
              const lane = laneMap.get(a.swimLaneId);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setFromId(a.id);
                    setError(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex items-center gap-1.5 ${
                    fromId === a.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  {lane && (
                    <span
                      className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                      style={{ backgroundColor: lane.color }}
                      title={lane.name}
                    >
                      {lane.shortName}
                    </span>
                  )}
                  <span className="truncate">{a.name}</span>
                </button>
              );
            })}
          </div>
          {fromName && (
            <p className="mt-1 text-xs text-blue-600">
              {fromPoint === "start" ? "Start" : "End"} of: {fromName}
            </p>
          )}
        </div>

        {/* To activity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To Activity
          </label>
          <div className="flex gap-2 mb-1">
            {POINT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setToPoint(opt.value)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  toPoint === opt.value
                    ? "border-jazz-purple bg-jazz-purple/10 text-jazz-purple"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search activities..."
              value={toSearch}
              onChange={(e) => setToSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white">
            {filteredTo.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">No results</p>
            )}
            {filteredTo.map((a) => {
              const lane = laneMap.get(a.swimLaneId);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setToId(a.id);
                    setError(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 flex items-center gap-1.5 ${
                    toId === a.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  {lane && (
                    <span
                      className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                      style={{ backgroundColor: lane.color }}
                      title={lane.name}
                    >
                      {lane.shortName}
                    </span>
                  )}
                  <span className="truncate">{a.name}</span>
                </button>
              );
            })}
          </div>
          {toName && (
            <p className="mt-1 text-xs text-blue-600">
              {toPoint === "start" ? "Start" : "End"} of: {toName}
            </p>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-jazz-purple px-4 py-2 text-sm font-medium text-white hover:bg-jazz-purple-light transition-colors"
          >
            {existing ? "Save" : "Add Metric"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
