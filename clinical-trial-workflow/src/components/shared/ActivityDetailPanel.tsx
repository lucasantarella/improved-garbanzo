"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useWorkflowStore, useCriticalPathIds } from "@/store/workflowStore";
import { X, Plus, ChevronDown } from "lucide-react";
import DependencyEditor from "./DependencyEditor";

const DEP_TYPE_COLORS: Record<string, string> = {
  FS: "bg-blue-100 text-blue-700",
  SS: "bg-green-100 text-green-700",
  FF: "bg-purple-100 text-purple-700",
  SF: "bg-amber-100 text-amber-700",
};

export default function ActivityDetailPanel() {
  const template = useWorkflowStore((s) => s.template);
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);
  const setSelectedActivity = useWorkflowStore((s) => s.setSelectedActivity);
  const updateActivity = useWorkflowStore((s) => s.updateActivity);
  const removeDependency = useWorkflowStore((s) => s.removeDependency);

  const criticalIds = useCriticalPathIds();
  const [showDepEditor, setShowDepEditor] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close tag dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTagDropdown(false);
      }
    }
    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showTagDropdown]);

  const activity = useMemo(
    () => template.activities.find((a) => a.id === selectedActivityId) ?? null,
    [template.activities, selectedActivityId]
  );

  if (!selectedActivityId || !activity) return null;

  // Resolve names for dependencies
  function getPredecessorName(predecessorId: string): string {
    const act = template.activities.find((a) => a.id === predecessorId);
    if (act) return act.name;
    const ms = template.milestones.find((m) => m.id === predecessorId);
    if (ms) return ms.name;
    return predecessorId;
  }

  // Available tags not yet assigned
  const availableTags = template.tags.filter(
    (t) => !activity.tags.includes(t.id)
  );

  // Assigned tags resolved
  const assignedTags = activity.tags
    .map((tid) => template.tags.find((t) => t.id === tid))
    .filter(Boolean) as typeof template.tags;

  function update(updates: Parameters<typeof updateActivity>[1]) {
    updateActivity(selectedActivityId!, updates);
  }

  return (
    <>
      <aside className="w-[400px] shrink-0 border-l border-gray-200 bg-white shadow-lg overflow-y-auto flex flex-col">
        <div className="p-4 space-y-5">
          {/* ---- Header ---- */}
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={activity.name}
              onChange={(e) => update({ name: e.target.value })}
              className="flex-1 text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-1"
            />
            <button
              onClick={() => setSelectedActivity(null)}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>

          {/* ---- Timing ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Timing
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Start Month
                </label>
                <input
                  type="number"
                  value={activity.startMonth}
                  onChange={(e) =>
                    update({ startMonth: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Duration
                </label>
                <input
                  type="number"
                  min={0}
                  value={activity.durationMonths}
                  onChange={(e) =>
                    update({ durationMonths: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  End Month
                </label>
                <input
                  type="number"
                  value={activity.endMonth}
                  readOnly
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Assignment ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Assignment
            </h3>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Swim Lane
                </label>
                <div className="relative">
                  <select
                    value={activity.swimLaneId}
                    onChange={(e) => update({ swimLaneId: e.target.value })}
                    className="w-full appearance-none rounded-md border border-gray-300 px-2.5 py-1.5 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {template.swimLanes.map((lane) => (
                      <option key={lane.id} value={lane.id}>
                        {lane.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={activity.owner}
                  onChange={(e) => update({ owner: e.target.value })}
                  placeholder="Enter owner..."
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Flags ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Flags
            </h3>
            <div className="flex flex-wrap gap-3">
              {/* Critical Path — computed from dependency graph, read-only */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                  criticalIds.has(activity.id)
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-gray-50 text-gray-400"
                }`}
                title="Computed from the dependency graph using the Critical Path Method"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    criticalIds.has(activity.id) ? "bg-red-500" : "bg-gray-300"
                  }`}
                />
                Critical Path
              </span>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activity.isOptional}
                  onChange={(e) => update({ isOptional: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Optional
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activity.isContinuous}
                  onChange={(e) =>
                    update({ isContinuous: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Continuous
              </label>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Milestone Gate ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Milestone Gate
            </h3>
            <div className="relative">
              <select
                value={activity.milestoneGateId ?? ""}
                onChange={(e) =>
                  update({
                    milestoneGateId: e.target.value || null,
                  })
                }
                className="w-full appearance-none rounded-md border border-gray-300 px-2.5 py-1.5 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">None</option>
                {template.milestones.map((ms) => (
                  <option key={ms.id} value={ms.id}>
                    {ms.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Dependencies ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Dependencies
            </h3>
            {activity.dependencies.length === 0 ? (
              <p className="text-sm text-gray-400 mb-2">No dependencies</p>
            ) : (
              <ul className="space-y-1.5 mb-2">
                {activity.dependencies.map((dep) => (
                  <li
                    key={dep.predecessorId}
                    className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-sm"
                  >
                    <span className="flex-1 truncate text-gray-700">
                      {getPredecessorName(dep.predecessorId)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        DEP_TYPE_COLORS[dep.type] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {dep.type}
                    </span>
                    {dep.lagMonths !== 0 && (
                      <span className="shrink-0 text-xs text-gray-500">
                        {dep.lagMonths > 0 ? "+" : ""}
                        {dep.lagMonths}m
                      </span>
                    )}
                    <button
                      onClick={() =>
                        removeDependency(activity.id, dep.predecessorId)
                      }
                      className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                      aria-label={`Remove dependency on ${getPredecessorName(dep.predecessorId)}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowDepEditor(true)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus size={14} />
              Add Dependency
            </button>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Tags ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {assignedTags.length === 0 && (
                <span className="text-sm text-gray-400">No tags</span>
              )}
              {assignedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() =>
                      update({
                        tags: activity.tags.filter((tid) => tid !== tag.id),
                      })
                    }
                    className="ml-0.5 rounded-full hover:bg-white/20 transition-colors"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setShowTagDropdown((v) => !v)}
                disabled={availableTags.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                Add Tag
              </button>
              {showTagDropdown && availableTags.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        update({ tags: [...activity.tags, tag.id] });
                        setShowTagDropdown(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* ---- Description ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Description
            </h3>
            <textarea
              value={activity.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Enter description..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </section>

          <hr className="border-gray-200" />

          {/* ---- Notes ---- */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
              Notes
            </h3>
            <textarea
              value={activity.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Enter notes..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </section>
        </div>
      </aside>

      {/* Dependency Editor Modal */}
      {showDepEditor && (
        <DependencyEditor
          activityId={activity.id}
          onClose={() => setShowDepEditor(false)}
        />
      )}
    </>
  );
}
