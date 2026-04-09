import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { useMemo } from 'react';

enableMapSet();
import {
  WorkflowTemplate,
  Activity,
  Dependency,
  Milestone,
  SwimLane,
  CycleTimeMetric,
  ViewMode,
  FilterState,
  ExportPayload,
} from '@/types';
import { jazzPharmaTemplate } from '@/data/jazzPharmaTemplate';
import { generateActivityId, generateMilestoneId, generateSwimLaneId, generateMetricId } from '@/utils/idGenerator';
import { temporalStore } from './undoMiddleware';
import { computeCriticalPath } from '@/utils/criticalPath';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function structuredCloneTemplate(t: WorkflowTemplate): WorkflowTemplate {
  return JSON.parse(JSON.stringify(t));
}

/** Snapshot the current template into the temporal store before mutating. */
function snapshot(template: WorkflowTemplate): void {
  temporalStore.getState().pushState(structuredCloneTemplate(template));
}

/**
 * Compute a milestone's month from its dependencies on activities.
 * Returns the latest dependency endpoint, or null if there are no valid dependencies.
 * For FS/SS the milestone sits at the predecessor's end/start + lag.
 * FF/SF also resolve to the predecessor's end/start + lag (milestone has zero duration).
 */
function computeMilestoneMonth(milestone: Milestone, activities: Activity[]): number | null {
  if (milestone.dependencies.length === 0) return null;

  const actMap = new Map<string, Activity>();
  for (const a of activities) actMap.set(a.id, a);

  let latest = -Infinity;
  let hasValid = false;

  for (const dep of milestone.dependencies) {
    const pred = actMap.get(dep.predecessorId);
    if (!pred) continue;

    let value: number;
    switch (dep.type) {
      case 'FS': // milestone after predecessor finishes
      case 'FF': // same semantics for zero-duration milestone
        value = pred.endMonth + dep.lagMonths;
        break;
      case 'SS': // milestone at predecessor start
      case 'SF': // same semantics for zero-duration milestone
        value = pred.startMonth + dep.lagMonths;
        break;
    }

    latest = Math.max(latest, value);
    hasValid = true;
  }

  return hasValid ? latest : null;
}

/**
 * Compute the earliest allowed start for an activity based on its dependencies.
 * Returns -Infinity if the activity has no valid dependencies (i.e. unconstrained).
 */
function computeEarliestStart(activity: Activity, actMap: Map<string, Activity>): number {
  let earliest = -Infinity;

  for (const dep of activity.dependencies) {
    const pred = actMap.get(dep.predecessorId);
    if (!pred) continue;

    let candidate: number;
    switch (dep.type) {
      case 'FS':
        candidate = pred.endMonth + dep.lagMonths;
        break;
      case 'SS':
        candidate = pred.startMonth + dep.lagMonths;
        break;
      case 'FF':
        // successor must finish after predecessor finishes + lag
        candidate = pred.endMonth + dep.lagMonths - activity.durationMonths;
        break;
      case 'SF':
        // successor must finish after predecessor starts + lag
        candidate = pred.startMonth + dep.lagMonths - activity.durationMonths;
        break;
    }
    earliest = Math.max(earliest, candidate);
  }

  return earliest;
}

/**
 * Propagate timing changes forward through the dependency graph.
 * When an activity moves or resizes, all transitive successors are pushed
 * forward so that dependency constraints are satisfied.
 * Also recomputes dependent milestone months.
 *
 * Uses topological BFS starting from the changed activity.
 */
function propagateDependencies(
  changedId: string,
  activities: Activity[],
  milestones: Milestone[],
): void {
  // Build lookup map and successor adjacency list
  const actMap = new Map<string, Activity>();
  for (const a of activities) actMap.set(a.id, a);

  // successors: predecessorId → list of successor activity objects
  const successors = new Map<string, Activity[]>();
  for (const a of activities) {
    for (const dep of a.dependencies) {
      let list = successors.get(dep.predecessorId);
      if (!list) {
        list = [];
        successors.set(dep.predecessorId, list);
      }
      list.push(a);
    }
  }

  // BFS from changedId through successor graph
  const queue: string[] = [changedId];
  const visited = new Set<string>();
  visited.add(changedId);

  while (queue.length > 0) {
    const predId = queue.shift()!;
    const succs = successors.get(predId);
    if (!succs) continue;

    for (const succ of succs) {
      const earliest = computeEarliestStart(succ, actMap);
      if (earliest > succ.startMonth) {
        succ.startMonth = earliest;
        succ.endMonth = succ.startMonth + succ.durationMonths;

        // This successor moved — enqueue it so its own successors get checked
        if (!visited.has(succ.id)) {
          visited.add(succ.id);
          queue.push(succ.id);
        }
      } else if (!visited.has(succ.id)) {
        // Even if this successor didn't move, still check further downstream
        // (an FF/SF dependency deeper in the graph might still be violated)
        visited.add(succ.id);
        queue.push(succ.id);
      }
    }
  }

  // Recompute milestones that depend on any activity that was visited
  for (const ms of milestones) {
    if (ms.dependencies.length === 0) continue;
    if (ms.dependencies.some((d) => visited.has(d.predecessorId))) {
      const computed = computeMilestoneMonth(ms, activities);
      if (computed !== null) ms.month = computed;
    }
  }
}

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

export interface WorkflowState {
  // State
  template: WorkflowTemplate;
  selectedActivityId: string | null;
  activeView: ViewMode;
  filters: FilterState;
  zoomLevel: number;
  isDirty: boolean;
  collapsedLanes: Set<string>;
  showDependencies: boolean;
  showMetricsPanel: boolean;

  // Actions
  setActiveView: (view: ViewMode) => void;
  setZoomLevel: (level: number) => void;
  setSelectedActivity: (id: string | null) => void;
  toggleLaneCollapse: (laneId: string) => void;
  updateFilters: (partial: Partial<FilterState>) => void;
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  addActivity: (swimLaneId: string) => string;
  insertActivityAfter: (afterActivityId: string, swimLaneId: string) => string;
  duplicateActivity: (id: string) => string | null;
  deleteActivity: (id: string) => void;
  addDependency: (activityId: string, dep: Dependency) => void;
  removeDependency: (activityId: string, predecessorId: string) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  addMilestone: (month: number) => string;
  deleteMilestone: (id: string) => void;
  addMilestoneDependency: (milestoneId: string, dep: Dependency) => void;
  removeMilestoneDependency: (milestoneId: string, predecessorId: string) => void;
  updateSwimLane: (id: string, updates: Partial<SwimLane>) => void;
  addSwimLane: (name: string, color: string) => string;
  deleteSwimLane: (id: string) => void;
  addCycleTimeMetric: (metric: Omit<CycleTimeMetric, 'id'>) => string;
  updateCycleTimeMetric: (id: string, updates: Partial<CycleTimeMetric>) => void;
  deleteCycleTimeMetric: (id: string) => void;
  toggleMetricsPanel: () => void;
  updateTemplateMeta: (
    updates: Partial<
      Pick<WorkflowTemplate, 'name' | 'description' | 'version' | 'author' | 'client'>
    >,
  ) => void;
  importTemplate: (template: WorkflowTemplate) => void;
  exportTemplate: () => ExportPayload;
  undo: () => void;
  redo: () => void;
  toggleDependencies: () => void;
  setDirty: (dirty: boolean) => void;
}

// ---------------------------------------------------------------------------
// Default filter state
// ---------------------------------------------------------------------------

const defaultFilters: FilterState = {
  swimLaneIds: [],
  tagIds: [],
  searchQuery: '',
  criticalPathOnly: false,
  timeRange: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkflowStore = create<WorkflowState>()(
  immer((set, get) => ({
    // ---- Initial state ----
    template: jazzPharmaTemplate,
    selectedActivityId: null,
    activeView: 'gantt' as ViewMode,
    filters: defaultFilters,
    zoomLevel: 2,
    isDirty: false,
    collapsedLanes: new Set<string>(),
    showDependencies: false,
    showMetricsPanel: false,

    // ---- View / UI actions (no template mutation, no snapshot) ----

    setActiveView: (view: ViewMode) => {
      set((state) => {
        state.activeView = view;
      });
    },

    setZoomLevel: (level: number) => {
      const clamped = Math.max(1, Math.min(4, level));
      set((state) => {
        state.zoomLevel = clamped;
      });
    },

    setSelectedActivity: (id: string | null) => {
      set((state) => {
        state.selectedActivityId = id;
      });
    },

    toggleLaneCollapse: (laneId: string) => {
      set((state) => {
        const lanes = state.collapsedLanes as Set<string>;
        if (lanes.has(laneId)) {
          lanes.delete(laneId);
        } else {
          lanes.add(laneId);
        }
      });
    },

    updateFilters: (partial: Partial<FilterState>) => {
      set((state) => {
        Object.assign(state.filters, partial);
      });
    },

    toggleDependencies: () => {
      set((state) => {
        state.showDependencies = !state.showDependencies;
      });
    },

    setDirty: (dirty: boolean) => {
      set((state) => {
        state.isDirty = dirty;
      });
    },

    // ---- Template-mutating actions (snapshot + isDirty) ----

    updateActivity: (id: string, updates: Partial<Activity>) => {
      set((state) => {
        snapshot(state.template);
        const activity = state.template.activities.find((a: Activity) => a.id === id);
        if (!activity) return;

        Object.assign(activity, updates);

        // Recompute endMonth when startMonth or durationMonths changes
        if ('startMonth' in updates || 'durationMonths' in updates) {
          activity.endMonth = activity.startMonth + activity.durationMonths;

          // Propagate timing changes to all downstream dependents
          propagateDependencies(id, state.template.activities, state.template.milestones);
        }

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    addActivity: (swimLaneId: string): string => {
      const newId = generateActivityId();
      set((state) => {
        snapshot(state.template);

        const newActivity: Activity = {
          id: newId,
          name: 'New Activity',
          swimLaneId,
          startMonth: 0,
          durationMonths: 1,
          endMonth: 1,
          isCriticalPath: false,
          isOptional: false,
          isContinuous: false,
          dependencies: [],
          milestoneGateId: null,
          description: '',
          tags: [],
          outputs: [],
          inputs: [],
          owner: '',
          estimatedEffortDays: null,
          notes: '',
          customFields: {},
        };

        state.template.activities.push(newActivity);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    insertActivityAfter: (afterActivityId: string, swimLaneId: string): string => {
      const newId = generateActivityId();
      set((state) => {
        snapshot(state.template);

        const afterIndex = state.template.activities.findIndex(
          (a: Activity) => a.id === afterActivityId,
        );
        const afterActivity = afterIndex >= 0 ? state.template.activities[afterIndex] : null;

        const newActivity: Activity = {
          id: newId,
          name: 'New Activity',
          swimLaneId,
          startMonth: afterActivity ? afterActivity.startMonth : 0,
          durationMonths: 1,
          endMonth: afterActivity ? afterActivity.startMonth + 1 : 1,
          isCriticalPath: false,
          isOptional: false,
          isContinuous: false,
          dependencies: [],
          milestoneGateId: null,
          description: '',
          tags: [],
          outputs: [],
          inputs: [],
          owner: '',
          estimatedEffortDays: null,
          notes: '',
          customFields: {},
        };

        if (afterIndex >= 0) {
          // Find the correct splice point: scan forward from afterIndex to find
          // the next activity in the SAME lane. Insert right before it so the
          // new activity appears visually between afterActivity and the next
          // same-lane activity. If no further same-lane activity exists, insert
          // right after afterIndex (end of lane in global order).
          const acts = state.template.activities;
          let insertAt = afterIndex + 1;
          while (insertAt < acts.length && acts[insertAt].swimLaneId !== swimLaneId) {
            insertAt++;
          }
          acts.splice(insertAt, 0, newActivity);
        } else {
          state.template.activities.push(newActivity);
        }

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    duplicateActivity: (id: string): string | null => {
      const { template } = get();
      const source = template.activities.find((a) => a.id === id);
      if (!source) return null;

      const newId = generateActivityId();
      set((state) => {
        snapshot(state.template);

        const sourceActivity = state.template.activities.find((a: Activity) => a.id === id);
        if (!sourceActivity) return;

        const duplicate: Activity = {
          ...JSON.parse(JSON.stringify(sourceActivity)),
          id: newId,
          name: `${sourceActivity.name} (copy)`,
        };

        state.template.activities.push(duplicate);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    deleteActivity: (id: string) => {
      set((state) => {
        snapshot(state.template);

        state.template.activities = state.template.activities.filter(
          (a: Activity) => a.id !== id,
        );

        // Also remove any dependencies referencing this activity
        for (const activity of state.template.activities) {
          activity.dependencies = activity.dependencies.filter(
            (d: Dependency) => d.predecessorId !== id,
          );
        }

        // Also remove milestone dependencies referencing this activity
        for (const ms of state.template.milestones) {
          const hadDep = ms.dependencies.some((d: Dependency) => d.predecessorId === id);
          if (hadDep) {
            ms.dependencies = ms.dependencies.filter(
              (d: Dependency) => d.predecessorId !== id,
            );
            // Recompute month from remaining dependencies
            const computed = computeMilestoneMonth(ms, state.template.activities);
            if (computed !== null) ms.month = computed;
          }
        }

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;

        // Clear selection if deleted activity was selected
        if (state.selectedActivityId === id) {
          state.selectedActivityId = null;
        }
      });
    },

    addDependency: (activityId: string, dep: Dependency) => {
      set((state) => {
        snapshot(state.template);
        const activity = state.template.activities.find((a: Activity) => a.id === activityId);
        if (!activity) return;

        activity.dependencies.push(dep);

        // Enforce the new constraint immediately — push the successor forward if needed
        propagateDependencies(dep.predecessorId, state.template.activities, state.template.milestones);

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    removeDependency: (activityId: string, predecessorId: string) => {
      set((state) => {
        snapshot(state.template);
        const activity = state.template.activities.find((a: Activity) => a.id === activityId);
        if (!activity) return;

        activity.dependencies = activity.dependencies.filter(
          (d: Dependency) => d.predecessorId !== predecessorId,
        );
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    updateMilestone: (id: string, updates: Partial<Milestone>) => {
      set((state) => {
        snapshot(state.template);
        const milestone = state.template.milestones.find((m: Milestone) => m.id === id);
        if (!milestone) return;

        Object.assign(milestone, updates);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    addMilestone: (month: number): string => {
      const newId = generateMilestoneId();
      set((state) => {
        snapshot(state.template);
        const newMilestone: Milestone = {
          id: newId,
          name: 'New Milestone',
          abbreviation: 'NEW',
          month,
          isCriticalPath: false,
          swimLaneId: 'sl-001',
          description: '',
          gateType: 'informational',
          gateApprovers: [],
          dependencies: [],
        };
        state.template.milestones.push(newMilestone);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    deleteMilestone: (id: string) => {
      set((state) => {
        snapshot(state.template);
        state.template.milestones = state.template.milestones.filter(
          (m: Milestone) => m.id !== id,
        );
        // Clear milestoneGateId references
        for (const activity of state.template.activities) {
          if (activity.milestoneGateId === id) {
            activity.milestoneGateId = null;
          }
        }
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    addMilestoneDependency: (milestoneId: string, dep: Dependency) => {
      set((state) => {
        snapshot(state.template);
        const milestone = state.template.milestones.find((m: Milestone) => m.id === milestoneId);
        if (!milestone) return;

        milestone.dependencies.push(dep);

        // Recompute milestone month from dependencies
        const computed = computeMilestoneMonth(milestone, state.template.activities);
        if (computed !== null) {
          milestone.month = computed;
        }

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    removeMilestoneDependency: (milestoneId: string, predecessorId: string) => {
      set((state) => {
        snapshot(state.template);
        const milestone = state.template.milestones.find((m: Milestone) => m.id === milestoneId);
        if (!milestone) return;

        milestone.dependencies = milestone.dependencies.filter(
          (d: Dependency) => d.predecessorId !== predecessorId,
        );

        // Recompute milestone month from remaining dependencies
        const computed = computeMilestoneMonth(milestone, state.template.activities);
        if (computed !== null) {
          milestone.month = computed;
        }

        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    updateSwimLane: (id: string, updates: Partial<SwimLane>) => {
      set((state) => {
        snapshot(state.template);
        const lane = state.template.swimLanes.find((l: SwimLane) => l.id === id);
        if (!lane) return;

        Object.assign(lane, updates);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    addSwimLane: (name: string, color: string): string => {
      const newId = generateSwimLaneId();
      set((state) => {
        snapshot(state.template);
        const maxOrder = state.template.swimLanes.reduce(
          (max: number, l: SwimLane) => Math.max(max, l.order),
          -1,
        );
        const newLane: SwimLane = {
          id: newId,
          name,
          shortName: name.substring(0, 8),
          color,
          order: maxOrder + 1,
          department: name,
          isCollapsible: true,
          isVisible: true,
        };
        state.template.swimLanes.push(newLane);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    deleteSwimLane: (id: string) => {
      set((state) => {
        snapshot(state.template);
        state.template.swimLanes = state.template.swimLanes.filter(
          (l: SwimLane) => l.id !== id,
        );
        // Remove activities in this lane
        state.template.activities = state.template.activities.filter(
          (a: Activity) => a.swimLaneId !== id,
        );
        // Clean up dependencies referencing deleted activities
        const activityIds = new Set(state.template.activities.map((a: Activity) => a.id));
        for (const activity of state.template.activities) {
          activity.dependencies = activity.dependencies.filter(
            (d: Dependency) => activityIds.has(d.predecessorId),
          );
        }
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    addCycleTimeMetric: (metric: Omit<CycleTimeMetric, 'id'>): string => {
      const newId = generateMetricId();
      set((state) => {
        snapshot(state.template);
        if (!state.template.cycleTimeMetrics) {
          state.template.cycleTimeMetrics = [];
        }
        state.template.cycleTimeMetrics.push({ id: newId, ...metric } as CycleTimeMetric);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
      return newId;
    },

    updateCycleTimeMetric: (id: string, updates: Partial<CycleTimeMetric>) => {
      set((state) => {
        snapshot(state.template);
        const metric = (state.template.cycleTimeMetrics ?? []).find(
          (m: CycleTimeMetric) => m.id === id,
        );
        if (!metric) return;
        Object.assign(metric, updates);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    deleteCycleTimeMetric: (id: string) => {
      set((state) => {
        snapshot(state.template);
        state.template.cycleTimeMetrics = (state.template.cycleTimeMetrics ?? []).filter(
          (m: CycleTimeMetric) => m.id !== id,
        );
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    toggleMetricsPanel: () => {
      set((state) => {
        state.showMetricsPanel = !state.showMetricsPanel;
      });
    },

    updateTemplateMeta: (
      updates: Partial<
        Pick<WorkflowTemplate, 'name' | 'description' | 'version' | 'author' | 'client'>
      >,
    ) => {
      set((state) => {
        snapshot(state.template);
        Object.assign(state.template, updates);
        state.template.updatedAt = new Date().toISOString();
        state.isDirty = true;
      });
    },

    importTemplate: (template: WorkflowTemplate) => {
      set((state) => {
        state.template = template as WorkflowTemplate;
        state.isDirty = false;
        state.selectedActivityId = null;
      });
      temporalStore.getState().clear();
    },

    exportTemplate: (): ExportPayload => {
      const { template } = get();
      return {
        $schema: 'https://jazz-pharma.com/schemas/workflow-template/v1',
        exportedAt: new Date().toISOString(),
        exportedBy: template.author || 'unknown',
        workflowTemplate: structuredCloneTemplate(template),
      };
    },

    undo: () => {
      const { template } = get();
      const previous = temporalStore.getState().undo(structuredCloneTemplate(template));
      if (previous) {
        set((state) => {
          state.template = previous as WorkflowTemplate;
          state.isDirty = true;
        });
      }
    },

    redo: () => {
      const { template } = get();
      const next = temporalStore.getState().redo(structuredCloneTemplate(template));
      if (next) {
        set((state) => {
          state.template = next as WorkflowTemplate;
          state.isDirty = true;
        });
      }
    },
  })),
);

// ---------------------------------------------------------------------------
// Computed selectors (exported as standalone hooks)
// ---------------------------------------------------------------------------

/**
 * Computes the critical path from the dependency graph using CPM.
 * Returns a Set of activity IDs on the critical path (float === 0).
 * This is purely computed — not stored, not manually toggled.
 */
export function useCriticalPathIds(): Set<string> {
  const activities = useWorkflowStore((s) => s.template.activities);

  return useMemo(() => {
    const results = computeCriticalPath(activities);
    const ids = new Set<string>();
    for (const r of results) {
      if (r.isCritical) ids.add(r.activityId);
    }
    return ids;
  }, [activities]);
}

/**
 * Returns the computed critical path duration in months.
 */
export function useCriticalPathDuration(): number {
  const activities = useWorkflowStore((s) => s.template.activities);

  return useMemo(() => {
    const results = computeCriticalPath(activities);
    const criticalResults = results.filter((r) => r.isCritical);
    if (criticalResults.length === 0) return 0;
    const maxEf = Math.max(...criticalResults.map((r) => r.earlyFinish));
    const minEs = Math.min(...criticalResults.map((r) => r.earlyStart));
    return maxEf - minEs;
  }, [activities]);
}

/** Returns activities filtered by current filter state. */
export function useFilteredActivities(): Activity[] {
  const activities = useWorkflowStore((s) => s.template.activities);
  const filters = useWorkflowStore((s) => s.filters);
  const criticalIds = useCriticalPathIds();

  return useMemo(() => {
    let result = activities;

    // Filter by swim lanes
    if (filters.swimLaneIds.length > 0) {
      result = result.filter((a) => filters.swimLaneIds.includes(a.swimLaneId));
    }

    // Filter by tags
    if (filters.tagIds.length > 0) {
      result = result.filter((a) => a.tags.some((t) => filters.tagIds.includes(t)));
    }

    // Filter by search query
    if (filters.searchQuery.trim() !== '') {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.owner.toLowerCase().includes(query),
      );
    }

    // Filter by critical path (computed, not stored)
    if (filters.criticalPathOnly) {
      result = result.filter((a) => criticalIds.has(a.id));
    }

    // Filter by time range
    if (filters.timeRange) {
      const [start, end] = filters.timeRange;
      result = result.filter((a) => a.endMonth > start && a.startMonth < end);
    }

    return result;
  }, [activities, filters, criticalIds]);
}

/** Groups filtered activities by their swimLaneId. */
export function useActivitiesByLane(): Record<string, Activity[]> {
  const filtered = useFilteredActivities();

  return useMemo(() => {
    const byLane: Record<string, Activity[]> = {};
    for (const activity of filtered) {
      if (!byLane[activity.swimLaneId]) {
        byLane[activity.swimLaneId] = [];
      }
      byLane[activity.swimLaneId].push(activity);
    }
    return byLane;
  }, [filtered]);
}

/**
 * Computes each cycle-time metric's value in months.
 * Returns null for a metric if either referenced activity is missing.
 */
export interface ComputedMetric {
  metric: CycleTimeMetric;
  months: number | null;
  fromActivityName: string;
  toActivityName: string;
}

export function useComputedCycleTimeMetrics(): ComputedMetric[] {
  const activities = useWorkflowStore((s) => s.template.activities);
  const metrics = useWorkflowStore((s) => s.template.cycleTimeMetrics ?? []);

  return useMemo(() => {
    const actMap = new Map<string, Activity>();
    for (const a of activities) actMap.set(a.id, a);

    return metrics.map((m) => {
      const fromAct = actMap.get(m.fromActivityId);
      const toAct = actMap.get(m.toActivityId);

      if (!fromAct || !toAct) {
        return {
          metric: m,
          months: null,
          fromActivityName: fromAct?.name ?? '(deleted)',
          toActivityName: toAct?.name ?? '(deleted)',
        };
      }

      const fromValue = m.fromPoint === 'start' ? fromAct.startMonth : fromAct.endMonth;
      const toValue = m.toPoint === 'start' ? toAct.startMonth : toAct.endMonth;

      return {
        metric: m,
        months: toValue - fromValue,
        fromActivityName: fromAct.name,
        toActivityName: toAct.name,
      };
    });
  }, [activities, metrics]);
}
