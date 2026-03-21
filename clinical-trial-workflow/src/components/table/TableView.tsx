"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Plus,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { useWorkflowStore, useFilteredActivities, useCriticalPathIds } from "@/store/workflowStore";
import type { Activity, SwimLane, Tag } from "@/types";
import EditableCell from "./EditableCell";
import DependencyChips from "./DependencyChips";
import TagChips from "./TagChips";

// ---------------------------------------------------------------------------
// Actions dropdown
// ---------------------------------------------------------------------------

function ActionsMenu({
  activityId,
  onEdit,
}: {
  activityId: string;
  onEdit: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const duplicateActivity = useWorkflowStore((s) => s.duplicateActivity);
  const deleteActivity = useWorkflowStore((s) => s.deleteActivity);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative flex justify-center" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        aria-label="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onEdit(activityId);
            }}
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              duplicateActivity(activityId);
            }}
          >
            <Copy className="h-3 w-3" /> Duplicate
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              deleteActivity(activityId);
            }}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format month display helper
// ---------------------------------------------------------------------------
function formatMonth(m: number): string {
  if (m < 0) return `${m}`;
  if (m === 0) return "0";
  return `+${m}`;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<Activity>();

// Fixed column widths for proper alignment
const COL_WIDTHS = {
  rowNumber: 44,
  name: 280,
  swimLane: 100,
  startMonth: 72,
  duration: 72,
  endMonth: 72,
  dependencies: 140,
  critical: 70,
  tags: 120,
  optional: 64,
  actions: 40,
} as const;

function buildColumns(
  swimLanes: SwimLane[],
  tags: Tag[],
  allActivities: Activity[],
  updateActivity: (id: string, updates: Partial<Activity>) => void,
  onEdit: (id: string) => void,
  criticalIds: Set<string>,
): ColumnDef<Activity, unknown>[] {
  return [
    // Row #
    columnHelper.display({
      id: "rowNumber",
      header: "#",
      size: COL_WIDTHS.rowNumber,
      cell: (info) => (
        <span className="tabular-nums text-xs text-gray-400 pl-1">
          {info.row.index + 1}
        </span>
      ),
    }) as ColumnDef<Activity, unknown>,

    // Activity Name (editable)
    columnHelper.accessor("name", {
      header: "Activity Name",
      size: COL_WIDTHS.name,
      cell: (info) => (
        <EditableCell
          value={info.getValue()}
          type="text"
          onChange={(v) =>
            updateActivity(info.row.original.id, { name: String(v) })
          }
        />
      ),
    }) as ColumnDef<Activity, unknown>,

    // Swim Lane (colored badge)
    columnHelper.accessor("swimLaneId", {
      header: "Lane",
      size: COL_WIDTHS.swimLane,
      cell: (info) => {
        const lane = swimLanes.find((l) => l.id === info.getValue());
        if (!lane) return <span className="text-xs text-gray-400">-</span>;
        return (
          <span
            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
            style={{ backgroundColor: lane.color }}
            title={lane.name}
          >
            {lane.shortName}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const laneA =
          swimLanes.find((l) => l.id === rowA.original.swimLaneId)?.order ?? 0;
        const laneB =
          swimLanes.find((l) => l.id === rowB.original.swimLaneId)?.order ?? 0;
        return laneA - laneB;
      },
    }) as ColumnDef<Activity, unknown>,

    // Start Month
    columnHelper.accessor("startMonth", {
      header: "Start",
      size: COL_WIDTHS.startMonth,
      cell: (info) => (
        <EditableCell
          value={info.getValue()}
          type="number"
          onChange={(v) =>
            updateActivity(info.row.original.id, { startMonth: Number(v) })
          }
        />
      ),
    }) as ColumnDef<Activity, unknown>,

    // Duration
    columnHelper.accessor("durationMonths", {
      header: "Dur.",
      size: COL_WIDTHS.duration,
      cell: (info) => (
        <EditableCell
          value={info.getValue()}
          type="number"
          onChange={(v) =>
            updateActivity(info.row.original.id, {
              durationMonths: Number(v),
            })
          }
        />
      ),
    }) as ColumnDef<Activity, unknown>,

    // End Month (computed, read-only)
    columnHelper.accessor("endMonth", {
      header: "End",
      size: COL_WIDTHS.endMonth,
      cell: (info) => (
        <span className="tabular-nums text-xs text-gray-500 block text-right pr-2">
          {formatMonth(info.getValue())}
        </span>
      ),
    }) as ColumnDef<Activity, unknown>,

    // Dependencies (chips)
    columnHelper.accessor("dependencies", {
      header: "Dependencies",
      size: COL_WIDTHS.dependencies,
      enableSorting: false,
      cell: (info) => (
        <DependencyChips
          dependencies={info.getValue()}
          allActivities={allActivities}
        />
      ),
    }) as ColumnDef<Activity, unknown>,

    // Critical Path (computed from CPM)
    columnHelper.display({
      id: "criticalPath",
      header: "Critical",
      size: COL_WIDTHS.critical,
      cell: (info) =>
        criticalIds.has(info.row.original.id) ? (
          <span className="inline-flex items-center justify-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-red-200">
            Yes
          </span>
        ) : (
          <span className="text-[10px] text-gray-300">-</span>
        ),
    }) as ColumnDef<Activity, unknown>,

    // Tags (colored badges)
    columnHelper.accessor("tags", {
      header: "Tags",
      size: COL_WIDTHS.tags,
      enableSorting: false,
      cell: (info) => <TagChips tagIds={info.getValue()} allTags={tags} />,
    }) as ColumnDef<Activity, unknown>,

    // Optional (toggle)
    columnHelper.accessor("isOptional", {
      header: "Opt.",
      size: COL_WIDTHS.optional,
      cell: (info) => (
        <div className="flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateActivity(info.row.original.id, {
                isOptional: !info.getValue(),
              });
            }}
            className={`h-4 w-7 rounded-full transition-colors ${
              info.getValue() ? "bg-jazz-purple" : "bg-gray-200"
            } relative`}
            aria-label={info.getValue() ? "Mark required" : "Mark optional"}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                info.getValue() ? "left-3.5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      ),
    }) as ColumnDef<Activity, unknown>,

    // Actions
    columnHelper.display({
      id: "actions",
      header: "",
      size: COL_WIDTHS.actions,
      cell: (info) => (
        <ActionsMenu activityId={info.row.original.id} onEdit={onEdit} />
      ),
    }) as ColumnDef<Activity, unknown>,
  ];
}

// ---------------------------------------------------------------------------
// Main TableView component
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 36;

export default function TableView() {
  const activities = useFilteredActivities();
  const swimLanes = useWorkflowStore((s) => s.template.swimLanes);
  const tags = useWorkflowStore((s) => s.template.tags);
  const allActivities = useWorkflowStore((s) => s.template.activities);
  const selectedActivityId = useWorkflowStore((s) => s.selectedActivityId);
  const setSelectedActivity = useWorkflowStore((s) => s.setSelectedActivity);
  const updateActivity = useWorkflowStore((s) => s.updateActivity);
  const addActivity = useWorkflowStore((s) => s.addActivity);
  const criticalIds = useCriticalPathIds();

  const [sorting, setSorting] = useState<SortingState>([]);

  const handleEdit = useCallback(
    (id: string) => {
      setSelectedActivity(id);
    },
    [setSelectedActivity],
  );

  const columns = useMemo(
    () =>
      buildColumns(swimLanes, tags, allActivities, updateActivity, handleEdit, criticalIds),
    [swimLanes, tags, allActivities, updateActivity, handleEdit, criticalIds],
  );

  const table = useReactTable({
    data: activities,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  const handleAddActivity = useCallback(() => {
    const firstLane = swimLanes[0];
    if (firstLane) {
      const newId = addActivity(firstLane.id);
      setSelectedActivity(newId);
    }
  }, [swimLanes, addActivity, setSelectedActivity]);

  // Compute total table width from column definitions
  const totalWidth = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Scrollable table area */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {/* Use CSS Grid for proper column alignment instead of <table> with absolute rows */}
        <div style={{ minWidth: totalWidth }}>
          {/* Sticky header */}
          <div
            className="sticky top-0 z-10 grid border-b border-gray-200 bg-gray-50/95 backdrop-blur-sm"
            style={{
              gridTemplateColumns: Object.values(COL_WIDTHS)
                .map((w) => `${w}px`)
                .join(" "),
            }}
          >
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className="flex items-center px-2 py-2 select-none"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 ${
                        header.column.getCanSort()
                          ? "cursor-pointer hover:text-gray-600"
                          : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <>
                          {header.column.getIsSorted() === "asc" && (
                            <ArrowUp className="h-3 w-3 text-jazz-purple" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ArrowDown className="h-3 w-3 text-jazz-purple" />
                          )}
                          {!header.column.getIsSorted() && (
                            <ArrowUpDown className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )),
            )}
          </div>

          {/* Virtualized body */}
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.original.id === selectedActivityId;
              const isEven = virtualRow.index % 2 === 0;
              return (
                <div
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  className={[
                    "grid cursor-pointer border-b border-gray-100/80 transition-colors",
                    isSelected
                      ? "bg-jazz-purple/5 ring-1 ring-inset ring-jazz-purple/30"
                      : isEven
                        ? "bg-white"
                        : "bg-gray-50/40",
                    !isSelected && "hover:bg-jazz-purple/[0.03]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    gridTemplateColumns: Object.values(COL_WIDTHS)
                      .map((w) => `${w}px`)
                      .join(" "),
                    height: `${ROW_HEIGHT}px`,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => setSelectedActivity(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex items-center px-2 overflow-hidden"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Activity button at the bottom */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2">
        <button
          onClick={handleAddActivity}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-jazz-purple hover:text-jazz-purple"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Activity
        </button>
      </div>
    </div>
  );
}
