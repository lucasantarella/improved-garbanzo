"use client";

import { useEffect } from "react";
import { useWorkflowStore } from "@/store/workflowStore";

export function useKeyboardShortcuts() {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const deleteActivity = useWorkflowStore((s) => s.deleteActivity);
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);
  const setSelectedActivity = useWorkflowStore((s) => s.setSelectedActivity);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Ignore shortcuts when inside an input / textarea / contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // Undo: Ctrl/Cmd + Z
      if (meta && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z
      if (meta && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
        return;
      }

      // Delete selected activity
      if ((e.key === "Delete" || e.key === "Backspace") && selectedActivityId) {
        e.preventDefault();
        deleteActivity(selectedActivityId);
        return;
      }

      // Escape: deselect
      if (e.key === "Escape" && selectedActivityId) {
        e.preventDefault();
        setSelectedActivity(null);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteActivity, selectedActivityId, setSelectedActivity]);
}
