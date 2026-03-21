"use client";

import React from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import TopBar from "@/components/layout/TopBar";
import FilterBar from "@/components/layout/FilterBar";
import StatusBar from "@/components/layout/StatusBar";
import GanttView from "@/components/gantt/GanttView";
import TableView from "@/components/table/TableView";
import ActivityDetailPanel from "@/components/shared/ActivityDetailPanel";
import { DragDropOverlay } from "@/components/shared/JsonImportExport";

export default function Home() {
  const activeView = useWorkflowStore((s) => s.activeView);
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);

  useKeyboardShortcuts();

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <FilterBar />
      <main className="flex-1 overflow-hidden flex">
        {activeView === "gantt" ? <GanttView /> : <TableView />}
        {selectedActivityId && <ActivityDetailPanel />}
      </main>
      <StatusBar />
      <DragDropOverlay />
    </div>
  );
}
