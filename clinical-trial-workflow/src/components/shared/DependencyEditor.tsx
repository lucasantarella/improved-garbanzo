"use client";

import React, { useState, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { DependencyType } from "@/types";
import Modal from "@/components/ui/Modal";
import { Search } from "lucide-react";

interface DependencyEditorProps {
  activityId: string;
  onClose: () => void;
}

const DEPENDENCY_TYPES: {
  value: DependencyType;
  label: string;
  name: string;
  desc: string;
}[] = [
  { value: "FS", label: "FS", name: "Finish-to-Start", desc: "Successor starts after predecessor finishes" },
  { value: "SS", label: "SS", name: "Start-to-Start", desc: "Both start at the same time" },
  { value: "FF", label: "FF", name: "Finish-to-Finish", desc: "Both finish at the same time" },
  { value: "SF", label: "SF", name: "Start-to-Finish", desc: "Successor finishes when predecessor starts" },
];

export default function DependencyEditor({
  activityId,
  onClose,
}: DependencyEditorProps) {
  const template = useWorkflowStore((s) => s.template);
  const addDependency = useWorkflowStore((s) => s.addDependency);

  const activity = template.activities.find((a) => a.id === activityId);

  const [search, setSearch] = useState("");
  const [selectedPredecessorId, setSelectedPredecessorId] = useState<
    string | null
  >(null);
  const [depType, setDepType] = useState<DependencyType>("FS");
  const [lag, setLag] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const existingPredecessorIds = useMemo(
    () => new Set(activity?.dependencies.map((d) => d.predecessorId) ?? []),
    [activity]
  );

  const candidates = useMemo(() => {
    const items: { id: string; name: string; kind: "activity" | "milestone" }[] =
      [];

    for (const a of template.activities) {
      if (a.id === activityId) continue;
      if (existingPredecessorIds.has(a.id)) continue;
      items.push({ id: a.id, name: a.name, kind: "activity" });
    }

    for (const m of template.milestones) {
      if (existingPredecessorIds.has(m.id)) continue;
      items.push({ id: m.id, name: m.name, kind: "milestone" });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return items.filter((i) => i.name.toLowerCase().includes(q));
    }

    return items;
  }, [template.activities, template.milestones, activityId, existingPredecessorIds, search]);

  function handleAdd() {
    if (!selectedPredecessorId) {
      setError("Select a predecessor.");
      return;
    }
    if (selectedPredecessorId === activityId) {
      setError("Cannot depend on self.");
      return;
    }
    if (existingPredecessorIds.has(selectedPredecessorId)) {
      setError("Dependency already exists.");
      return;
    }

    addDependency(activityId, {
      predecessorId: selectedPredecessorId,
      type: depType,
      lagMonths: lag,
    });
    onClose();
  }

  const selectedName = candidates.find(
    (c) => c.id === selectedPredecessorId
  )?.name;

  return (
    <Modal title="Add Dependency" onClose={onClose}>
      <div className="space-y-4">
        {/* Searchable predecessor selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Predecessor
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search activities or milestones..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setError(null);
              }}
              className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white">
            {candidates.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">
                No matching items
              </p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedPredecessorId(c.id);
                    setError(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${
                    selectedPredecessorId === c.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="ml-2 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {c.kind}
                  </span>
                </button>
              ))
            )}
          </div>
          {selectedName && (
            <p className="mt-1 text-xs text-blue-600">
              Selected: {selectedName}
            </p>
          )}
        </div>

        {/* Dependency Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DEPENDENCY_TYPES.map((dt) => (
              <button
                key={dt.value}
                type="button"
                onClick={() => setDepType(dt.value)}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                  depType === dt.value
                    ? "border-jazz-purple bg-jazz-purple/5 ring-1 ring-jazz-purple"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold ${
                      depType === dt.value ? "text-jazz-purple" : "text-gray-700"
                    }`}
                  >
                    {dt.label}
                  </span>
                  <span
                    className={`text-xs ${
                      depType === dt.value ? "text-jazz-purple/70" : "text-gray-500"
                    }`}
                  >
                    {dt.name}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px] leading-tight text-gray-400">
                  {dt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lag */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lag (months)
          </label>
          <input
            type="number"
            value={lag}
            onChange={(e) => setLag(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
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
            onClick={handleAdd}
            className="rounded-md bg-jazz-purple px-4 py-2 text-sm font-medium text-white hover:bg-jazz-purple-light transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
