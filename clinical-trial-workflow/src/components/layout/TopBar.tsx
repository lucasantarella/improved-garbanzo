"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  Undo2,
  Redo2,
  Minus,
  Plus,
} from "lucide-react";
import { useWorkflowStore } from "@/store/workflowStore";
import { temporalStore } from "@/store/undoMiddleware";
import ViewToggle from "@/components/shared/ViewToggle";
import Button from "@/components/ui/Button";
import { ImportButton, ExportButton } from "@/components/shared/JsonImportExport";
import jazzLogo from "@/app/assets/jazz-logo.svg";

const ZOOM_LABELS: Record<number, string> = {
  1: "Quarter",
  2: "Month",
  3: "Week",
};

export default function TopBar() {
  const templateName = useWorkflowStore((s) => s.template.name);
  const updateTemplateMeta = useWorkflowStore((s) => s.updateTemplateMeta);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const activeView = useWorkflowStore((s) => s.activeView);
  const zoomLevel = useWorkflowStore((s) => s.zoomLevel);
  const setZoomLevel = useWorkflowStore((s) => s.setZoomLevel);

  const hasPast = temporalStore((s) => s.past.length > 0);
  const hasFuture = temporalStore((s) => s.future.length > 0);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(templateName);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setEditValue(templateName);
    setIsEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [templateName]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== templateName) {
      updateTemplateMeta({ name: trimmed });
    }
    setIsEditing(false);
  }, [editValue, templateName, updateTemplateMeta]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    [commitEdit],
  );

  return (
    <header className="flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm">
      {/* Jazz logo */}
      <Image
        src={jazzLogo}
        alt="Jazz Pharmaceuticals"
        height={28}
        className="shrink-0"
      />

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Editable template name */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="rounded border border-jazz-purple bg-white px-2 py-0.5 text-sm text-gray-800 outline-none ring-1 ring-jazz-purple"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="rounded px-2 py-0.5 text-sm font-medium text-jazz-navy hover:bg-gray-50 transition-colors truncate max-w-[300px]"
          title="Click to edit template name"
        >
          {templateName}
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle */}
      <ViewToggle />

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          icon={Undo2}
          onClick={undo}
          disabled={!hasPast}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        />
        <Button
          variant="ghost"
          size="sm"
          icon={Redo2}
          onClick={redo}
          disabled={!hasFuture}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        />
      </div>

      {/* Zoom controls - always rendered to avoid CLS, invisible in table mode */}
      <div className={activeView === "gantt" ? "" : "invisible"}>
        <div className="h-6 w-px bg-gray-200" />
      </div>
      <div className={`flex items-center gap-0.5 ${activeView === "gantt" ? "" : "invisible"}`}>
        <Button
          variant="ghost"
          size="sm"
          icon={Minus}
          onClick={() => setZoomLevel(zoomLevel - 1)}
          disabled={zoomLevel <= 1}
          aria-label="Zoom out"
        />
        <span className="min-w-[48px] text-center text-xs font-medium text-gray-500">
          {ZOOM_LABELS[zoomLevel] ?? `${zoomLevel}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => setZoomLevel(zoomLevel + 1)}
          disabled={zoomLevel >= 3}
          aria-label="Zoom in"
        />
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* File actions */}
      <div className="flex items-center gap-0.5">
        <ImportButton />
        <ExportButton />
      </div>
    </header>
  );
}
