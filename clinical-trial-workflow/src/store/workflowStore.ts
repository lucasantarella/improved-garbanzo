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
  ViewMode,
  FilterState,
  ExportPayload,
} from '@/types';
import { jazzPharmaTemplate } from '@/data/jazzPharmaTemplate';
import { generateActivityId, generateMilestoneId, generateSwimLaneId } from '@/utils/idGenerator';
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
  updateSwimLane: (id: string, updates: Partial<SwimLane>) => void;
  addSwimLane: (name: string, color: string) => string;
  deleteSwimLane: (id: string) => void;
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

    // ---- View / UI actions (no template mutation, no snapshot) ----

    setActiveView: (view: ViewMode) => {
      set((state) => {
        state.activeView = view;
      });
    },

    setZoomLevel: (level: number) => {
      const clamped = Math.max(1, Math.min(3, level));
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
          state.template.activities.splice(afterIndex + 1, 0, newActivity);
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
