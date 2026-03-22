"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import type { Milestone, GateType } from "@/types";
import { useWorkflowStore } from "@/store/workflowStore";

interface MilestoneMarkerProps {
  milestone: Milestone;
  columnWidth: number;
  rangeStart: number;
}

const GATE_COLORS: Record<string, string> = {
  approval: "#ef4444",
  review: "#f59e0b",
  informational: "#3b82f6",
};

const GATE_OPTIONS: { value: GateType; label: string }[] = [
  { value: "approval", label: "Approval" },
  { value: "review", label: "Review" },
  { value: "informational", label: "Informational" },
];

function MilestoneEditPopover({
  milestone,
  position,
  onClose,
}: {
  milestone: Milestone;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const updateMilestone = useWorkflowStore((s) => s.updateMilestone);
  const deleteMilestone = useWorkflowStore((s) => s.deleteMilestone);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(milestone.name);
  const [abbreviation, setAbbreviation] = useState(milestone.abbreviation);
  const [month, setMonth] = useState(milestone.month);
  const [gateType, setGateType] = useState<GateType>(milestone.gateType);
  const [isCriticalPath, setIsCriticalPath] = useState(milestone.isCriticalPath);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const handleSave = useCallback(() => {
    updateMilestone(milestone.id, {
      name: name.trim() || milestone.name,
      abbreviation: abbreviation.trim() || milestone.abbreviation,
      month,
      gateType,
      isCriticalPath,
    });
    onClose();
  }, [milestone, name, abbreviation, month, gateType, isCriticalPath, updateMilestone, onClose]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Delete milestone "${milestone.name}"?`)) {
      deleteMilestone(milestone.id);
      onClose();
    }
  }, [milestone, deleteMilestone, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") onClose();
    },
    [handleSave, onClose],
  );

  // Position: try below the marker, but flip up if near bottom of viewport
  const popoverStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
    transform: "translateX(-50%)",
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-[280px] rounded-lg border border-gray-200 bg-white shadow-xl"
      style={popoverStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">Edit Milestone</span>
        <button
          onClick={handleDelete}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Delete milestone"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Name */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
            autoFocus
          />
        </div>

        {/* Abbreviation + Month in a row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Abbreviation</label>
            <input
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
              maxLength={8}
            />
          </div>
          <div className="w-20">
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Month</label>
            <input
              type="number"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs tabular-nums text-right outline-none focus:border-jazz-purple/40 focus:ring-1 focus:ring-jazz-purple/30"
            />
          </div>
        </div>

        {/* Gate type */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Gate Type</label>
          <div className="flex rounded border border-gray-200 overflow-hidden">
            {GATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGateType(opt.value)}
                className={`flex-1 py-1 text-[11px] font-medium transition-colors ${
                  gateType === opt.value
                    ? "text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
                style={
                  gateType === opt.value
                    ? { backgroundColor: GATE_COLORS[opt.value] }
                    : undefined
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Critical path toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isCriticalPath}
            onChange={(e) => setIsCriticalPath(e.target.checked)}
            className="rounded border-gray-300 text-jazz-purple focus:ring-jazz-purple/30"
          />
          <span className="text-xs text-gray-600">Critical path</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-jazz-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-jazz-purple-light"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function MilestoneMarker({
  milestone,
  columnWidth,
  rangeStart,
}: MilestoneMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const left =
    (milestone.month - rangeStart) * columnWidth + columnWidth / 2;
  const color = GATE_COLORS[milestone.gateType] ?? "#6b7280";
  const size = 14;

  useEffect(() => {
    if (hovered && markerRef.current && !editing) {
      const rect = markerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 6,
      });
    }
  }, [hovered, editing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      setPopoverPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setEditing(true);
    setHovered(false);
  }, []);

  return (
    <div
      ref={markerRef}
      className="absolute"
      style={{
        left: left - size / 2,
        top: 2,
        width: size,
        height: size,
      }}
      onMouseEnter={() => !editing && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Diamond shape */}
      <div
        className="w-full h-full rotate-45 cursor-pointer hover:scale-125 transition-transform"
        style={{
          backgroundColor: color,
          boxShadow: milestone.isCriticalPath
            ? `0 0 8px 2px ${color}66`
            : editing
              ? `0 0 0 2px ${color}44`
              : "none",
        }}
        onClick={handleClick}
      />

      {/* Tooltip — only when hovering and NOT editing */}
      {hovered &&
        !editing &&
        tooltipPos &&
        createPortal(
          <div
            className="fixed z-[9999] px-2.5 py-1.5 text-xs rounded-md shadow-lg bg-gray-900/95 text-white whitespace-nowrap pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold">{milestone.name}</div>
            <div className="text-gray-300 text-[11px]">
              {milestone.abbreviation} &middot; Month {milestone.month}
            </div>
            <div className="text-gray-400 text-[10px]">
              <span className="capitalize">{milestone.gateType}</span> &middot; Click to edit
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-gray-900/95"
            />
          </div>,
          document.body,
        )}

      {/* Edit popover */}
      {editing && popoverPos && (
        <MilestoneEditPopover
          milestone={milestone}
          position={popoverPos}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
