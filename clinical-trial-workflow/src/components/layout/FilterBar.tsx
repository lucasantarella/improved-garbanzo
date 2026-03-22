"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Zap, Plus, Pencil, X, Check, Trash2 } from "lucide-react";
import { useWorkflowStore, useFilteredActivities } from "@/store/workflowStore";
import type { SwimLane } from "@/types";

// ---------------------------------------------------------------------------
// Predefined color palette for new lanes
// ---------------------------------------------------------------------------
const LANE_COLORS = [
  "#3b82f6", "#a3e635", "#c084fc", "#60a5fa", "#f472b6",
  "#fb7185", "#fbbf24", "#34d399", "#fb923c", "#818cf8",
  "#facc15", "#9ca3af", "#d1d5db", "#f97316", "#06b6d4",
  "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#78716c",
];

// ---------------------------------------------------------------------------
// Swim Lane Edit Modal
// ---------------------------------------------------------------------------
function SwimLaneManager({ onClose }: { onClose: () => void }) {
  const swimLanes = useWorkflowStore((s) => s.template.swimLanes);
  const updateSwimLane = useWorkflowStore((s) => s.updateSwimLane);
  const deleteSwimLane = useWorkflowStore((s) => s.deleteSwimLane);
  const activities = useWorkflowStore((s) => s.template.activities);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editColor, setEditColor] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const startEdit = useCallback((lane: SwimLane) => {
    setEditingId(lane.id);
    setEditName(lane.name);
    setEditShortName(lane.shortName);
    setEditColor(lane.color);
    requestAnimationFrame(() => editRef.current?.focus());
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      updateSwimLane(editingId, {
        name: editName.trim(),
        shortName: editShortName.trim() || editName.trim().substring(0, 8),
        color: editColor,
      });
    }
    setEditingId(null);
  }, [editingId, editName, editShortName, editColor, updateSwimLane]);

  const handleDelete = useCallback(
    (lane: SwimLane) => {
      const count = activities.filter((a) => a.swimLaneId === lane.id).length;
      const msg = count > 0
        ? `Delete "${lane.name}" and its ${count} activities?`
        : `Delete "${lane.name}"?`;
      if (window.confirm(msg)) {
        deleteSwimLane(lane.id);
      }
    },
    [activities, deleteSwimLane],
  );

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 mt-1 w-[400px] rounded-lg border border-gray-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">
          Manage Swim Lanes
        </span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-2">
        {swimLanes.map((lane) => {
          const count = activities.filter(
            (a) => a.swimLaneId === lane.id,
          ).length;

          if (editingId === lane.id) {
            return (
              <div
                key={lane.id}
                className="flex items-center gap-2 rounded-md bg-gray-50 p-2 mb-1"
              >
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 p-0"
                  title="Lane color"
                />
                <div className="flex-1 flex gap-1.5">
                  <input
                    ref={editRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <input
                    type="text"
                    value={editShortName}
                    onChange={(e) => setEditShortName(e.target.value)}
                    placeholder="Short"
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                </div>
                <button
                  onClick={commitEdit}
                  className="rounded p-1 text-green-600 hover:bg-green-50"
                  title="Save"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={lane.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 mb-0.5 hover:bg-gray-50 transition-colors"
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: lane.color }}
              />
              <span className="flex-1 text-xs text-gray-700 truncate">
                {lane.name}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                {count}
              </span>
              <button
                onClick={() => startEdit(lane)}
                className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 transition-opacity"
                title="Edit lane"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDelete(lane)}
                className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-opacity"
                title="Delete lane"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Swim Lane Popover
// ---------------------------------------------------------------------------
function AddSwimLanePopover({ onClose }: { onClose: () => void }) {
  const addSwimLane = useWorkflowStore((s) => s.addSwimLane);
  const swimLanes = useWorkflowStore((s) => s.template.swimLanes);
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => {
    const usedColors = new Set(swimLanes.map((l) => l.color));
    return LANE_COLORS.find((c) => !usedColors.has(c)) || LANE_COLORS[0];
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addSwimLane(trimmed, color);
    onClose();
  }, [name, color, addSwimLane, onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full z-50 mt-1 w-[300px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
    >
      <div className="text-xs font-semibold text-gray-700 mb-2">
        New Swim Lane
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 p-0"
          title="Lane color"
        />
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lane name..."
          className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />
      </div>
      {/* Quick color picker */}
      <div className="flex flex-wrap gap-1 mb-3">
        {LANE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-sm transition-all ${
              color === c
                ? "ring-2 ring-jazz-purple ring-offset-1 scale-110"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="rounded bg-jazz-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-jazz-purple-light disabled:opacity-40 disabled:pointer-events-none"
        >
          Add Lane
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------
export default function FilterBar() {
  const swimLanes = useWorkflowStore((s) => s.template.swimLanes);
  const activities = useWorkflowStore((s) => s.template.activities);
  const totalActivities = activities.length;
  const filters = useWorkflowStore((s) => s.filters);
  const updateFilters = useWorkflowStore((s) => s.updateFilters);
  const deleteSwimLane = useWorkflowStore((s) => s.deleteSwimLane);
  const filteredActivities = useFilteredActivities();

  const [showAddLane, setShowAddLane] = useState(false);
  const [showEditLanes, setShowEditLanes] = useState(false);
  const [confirmDeleteLane, setConfirmDeleteLane] = useState<string | null>(null);

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilters({ searchQuery: searchInput });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, updateFilters]);

  const toggleSwimLane = useCallback(
    (laneId: string) => {
      const current = filters.swimLaneIds;
      const next = current.includes(laneId)
        ? current.filter((id) => id !== laneId)
        : [...current, laneId];
      updateFilters({ swimLaneIds: next });
    },
    [filters.swimLaneIds, updateFilters],
  );

  const toggleCriticalPath = useCallback(() => {
    updateFilters({ criticalPathOnly: !filters.criticalPathOnly });
  }, [filters.criticalPathOnly, updateFilters]);

  return (
    <div className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-4 py-2.5">
      {/* Swim lane filters + management */}
      <div className="relative flex items-center gap-1.5 flex-wrap py-1">
        {swimLanes.map((lane) => {
          const isActive =
            filters.swimLaneIds.length === 0 ||
            filters.swimLaneIds.includes(lane.id);
          return (
            <div key={lane.id} className="group/pill relative inline-flex">
              <button
                type="button"
                onClick={() => toggleSwimLane(lane.id)}
                className={[
                  "inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium transition-all",
                  isActive
                    ? "opacity-100 shadow-sm"
                    : "opacity-30 grayscale",
                ].join(" ")}
                style={{
                  backgroundColor: isActive ? lane.color : "#e5e7eb",
                  color: isActive ? "#fff" : "#9ca3af",
                }}
                title={lane.name}
              >
                {lane.shortName}
              </button>
              {/* Delete button on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteLane(lane.id);
                }}
                className="absolute -top-1.5 -right-1.5 hidden group-hover/pill:flex items-center justify-center h-3.5 w-3.5 rounded-full bg-gray-700 text-white hover:bg-red-500 transition-colors shadow-sm"
                title={`Delete ${lane.name}`}
              >
                <X size={8} strokeWidth={3} />
              </button>
            </div>
          );
        })}

        {/* Add lane button */}
        <button
          type="button"
          onClick={() => {
            setShowAddLane((v) => !v);
            setShowEditLanes(false);
          }}
          className="inline-flex items-center justify-center rounded border border-dashed border-gray-300 p-0.5 text-gray-400 transition-colors hover:border-jazz-purple hover:text-jazz-purple"
          title="Add swim lane"
        >
          <Plus size={12} />
        </button>

        {/* Edit lanes button */}
        <button
          type="button"
          onClick={() => {
            setShowEditLanes((v) => !v);
            setShowAddLane(false);
          }}
          className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="Manage swim lanes"
        >
          <Pencil size={11} />
        </button>

        {/* Popovers */}
        {showAddLane && (
          <AddSwimLanePopover onClose={() => setShowAddLane(false)} />
        )}
        {showEditLanes && (
          <SwimLaneManager onClose={() => setShowEditLanes(false)} />
        )}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-gray-200 shrink-0" />

      {/* Search */}
      <div className="relative shrink-0">
        <Search
          size={13}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-6 w-40 rounded border border-gray-200 bg-gray-50 pl-7 pr-2 text-[11px] text-gray-700 placeholder-gray-400 outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30 focus:bg-white"
        />
      </div>

      {/* Critical path toggle */}
      <button
        type="button"
        onClick={toggleCriticalPath}
        className={[
          "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
          filters.criticalPathOnly
            ? "bg-jazz-gold/20 text-jazz-navy border border-jazz-gold/40"
            : "text-gray-500 border border-gray-200 hover:bg-gray-50",
        ].join(" ")}
      >
        <Zap size={11} aria-hidden="true" />
        Critical Path
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Activity count */}
      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
        {filteredActivities.length === totalActivities
          ? `${totalActivities} activities`
          : `${filteredActivities.length} of ${totalActivities}`}
      </span>

      {/* Delete lane confirmation modal */}
      {confirmDeleteLane && (() => {
        const lane = swimLanes.find((l) => l.id === confirmDeleteLane);
        if (!lane) return null;
        const count = activities.filter((a) => a.swimLaneId === lane.id).length;
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
            onClick={() => setConfirmDeleteLane(null)}
          >
            <div
              className="w-[360px] rounded-lg bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Delete &ldquo;{lane.name}&rdquo;?
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {count > 0
                  ? `This will permanently remove the swim lane and its ${count} activit${count === 1 ? "y" : "ies"}. This action cannot be undone.`
                  : "This will permanently remove the empty swim lane."}
              </p>
              {count > 0 && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-[11px] font-medium text-red-700">
                    {count} activit{count === 1 ? "y" : "ies"} will be deleted
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteLane(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    deleteSwimLane(lane.id);
                    setConfirmDeleteLane(null);
                  }}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete Lane
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
