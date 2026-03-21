import type { Activity, Milestone, Conflict } from '@/types';

/**
 * Represents the scheduling data for an activity computed by CPM.
 */
export interface CpmResult {
  activityId: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  isCritical: boolean;
}

/**
 * Compute the Critical Path Method (CPM) schedule for a set of activities.
 *
 * Algorithm:
 * 1. Build adjacency list from activity dependencies (FS type with lag).
 * 2. Topological sort using Kahn's algorithm (detects cycles).
 * 3. Forward pass: compute Early Start (ES) and Early Finish (EF).
 * 4. Backward pass: compute Late Finish (LF) and Late Start (LS).
 * 5. Float = LS - ES. Critical path = activities where float === 0.
 */
export function computeCriticalPath(activities: Activity[]): CpmResult[] {
  if (activities.length === 0) return [];

  const activityMap = new Map<string, Activity>();
  for (const act of activities) {
    activityMap.set(act.id, act);
  }

  // Build adjacency list and in-degree count
  // successors[actId] = list of successor activity IDs
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const act of activities) {
    if (!successors.has(act.id)) successors.set(act.id, []);
    if (!inDegree.has(act.id)) inDegree.set(act.id, 0);
  }

  for (const act of activities) {
    for (const dep of act.dependencies) {
      // dep.predecessorId -> act.id (predecessor finishes before successor starts)
      if (!activityMap.has(dep.predecessorId)) continue;

      const succs = successors.get(dep.predecessorId);
      if (succs) succs.push(act.id);

      inDegree.set(act.id, (inDegree.get(act.id) ?? 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  const tempInDegree = new Map(inDegree);

  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);

    for (const succ of successors.get(current) ?? []) {
      const newDeg = (tempInDegree.get(succ) ?? 1) - 1;
      tempInDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  // If topological sort doesn't include all activities, there is a cycle.
  // Return partial results for non-cyclic activities.
  if (topoOrder.length < activities.length) {
    // Fall back: only process activities that were sorted
    const sortedSet = new Set(topoOrder);
    const processable = activities.filter((a) => sortedSet.has(a.id));
    if (processable.length === 0) {
      return activities.map((act) => ({
        activityId: act.id,
        earlyStart: act.startMonth,
        earlyFinish: act.endMonth,
        lateStart: act.startMonth,
        lateFinish: act.endMonth,
        totalFloat: 0,
        isCritical: false,
      }));
    }
    // Process only the non-cyclic subset
    return computeCriticalPath(processable);
  }

  // Forward pass: compute ES and EF
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const id of topoOrder) {
    const act = activityMap.get(id)!;
    let earlyStart = act.startMonth;

    // Check all predecessors
    for (const dep of act.dependencies) {
      if (!activityMap.has(dep.predecessorId)) continue;
      const predEf = ef.get(dep.predecessorId) ?? 0;

      switch (dep.type) {
        case 'FS': {
          // Finish-to-Start: successor starts after predecessor finishes + lag
          const candidate = predEf + dep.lagMonths;
          earlyStart = Math.max(earlyStart, candidate);
          break;
        }
        case 'SS': {
          // Start-to-Start: successor starts after predecessor starts + lag
          const predEs = es.get(dep.predecessorId) ?? 0;
          const candidate = predEs + dep.lagMonths;
          earlyStart = Math.max(earlyStart, candidate);
          break;
        }
        case 'FF': {
          // Finish-to-Finish: successor finishes after predecessor finishes + lag
          // EF_succ >= EF_pred + lag => ES_succ >= EF_pred + lag - duration
          const candidate = predEf + dep.lagMonths - act.durationMonths;
          earlyStart = Math.max(earlyStart, candidate);
          break;
        }
        case 'SF': {
          // Start-to-Finish: successor finishes after predecessor starts + lag
          // EF_succ >= ES_pred + lag => ES_succ >= ES_pred + lag - duration
          const predEs = es.get(dep.predecessorId) ?? 0;
          const candidate = predEs + dep.lagMonths - act.durationMonths;
          earlyStart = Math.max(earlyStart, candidate);
          break;
        }
      }
    }

    es.set(id, earlyStart);
    ef.set(id, earlyStart + act.durationMonths);
  }

  // Find project end (max EF)
  let projectEnd = -Infinity;
  for (const [, finish] of ef) {
    projectEnd = Math.max(projectEnd, finish);
  }

  // Backward pass: compute LF and LS
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();

  // Initialize all late finishes to project end
  for (const act of activities) {
    lf.set(act.id, projectEnd);
  }

  // Process in reverse topological order
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const act = activityMap.get(id)!;

    // Check all successors to constrain LF
    for (const succId of successors.get(id) ?? []) {
      const succAct = activityMap.get(succId)!;
      const succLs = ls.get(succId);
      const succLf = lf.get(succId);

      // Find the dependency from successor to this activity
      for (const dep of succAct.dependencies) {
        if (dep.predecessorId !== id) continue;

        switch (dep.type) {
          case 'FS': {
            // LF_pred <= LS_succ - lag
            const candidate = (succLs ?? projectEnd) - dep.lagMonths;
            lf.set(id, Math.min(lf.get(id)!, candidate));
            break;
          }
          case 'SS': {
            // LS_pred <= LS_succ - lag
            // => LF_pred <= LS_succ - lag + duration
            const candidate = (succLs ?? projectEnd) - dep.lagMonths + act.durationMonths;
            lf.set(id, Math.min(lf.get(id)!, candidate));
            break;
          }
          case 'FF': {
            // LF_pred <= LF_succ - lag
            const candidate = (succLf ?? projectEnd) - dep.lagMonths;
            lf.set(id, Math.min(lf.get(id)!, candidate));
            break;
          }
          case 'SF': {
            // LS_pred <= LF_succ - lag
            // => LF_pred <= LF_succ - lag + duration
            const candidate = (succLf ?? projectEnd) - dep.lagMonths + act.durationMonths;
            lf.set(id, Math.min(lf.get(id)!, candidate));
            break;
          }
        }
      }
    }

    ls.set(id, lf.get(id)! - act.durationMonths);
  }

  // Build results
  const results: CpmResult[] = [];
  for (const act of activities) {
    const earlyStart = es.get(act.id)!;
    const earlyFinish = ef.get(act.id)!;
    const lateStart = ls.get(act.id)!;
    const lateFinish = lf.get(act.id)!;
    const totalFloat = lateStart - earlyStart;

    results.push({
      activityId: act.id,
      earlyStart,
      earlyFinish,
      lateStart,
      lateFinish,
      totalFloat,
      isCritical: Math.abs(totalFloat) < 1e-9,
    });
  }

  return results;
}

/**
 * Get the IDs of activities on the critical path.
 */
export function getCriticalPathIds(activities: Activity[]): string[] {
  return computeCriticalPath(activities)
    .filter((r) => r.isCritical)
    .map((r) => r.activityId);
}

/**
 * Detect circular dependencies among activities using DFS with 3-color marking.
 *
 * White (0) = unvisited
 * Gray (1)  = in current DFS path (visiting)
 * Black (2) = fully processed
 *
 * Returns a list of Conflict objects for each activity involved in a cycle.
 */
export function detectCircularDependencies(activities: Activity[]): Conflict[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const activityMap = new Map<string, Activity>();
  for (const act of activities) {
    activityMap.set(act.id, act);
  }

  const color = new Map<string, number>();
  for (const act of activities) {
    color.set(act.id, WHITE);
  }

  const conflicts: Conflict[] = [];
  const cycleMembers = new Set<string>();

  // Build adjacency: predecessorId -> [activityId] (dependency direction)
  const adjList = new Map<string, string[]>();
  for (const act of activities) {
    if (!adjList.has(act.id)) adjList.set(act.id, []);
  }
  for (const act of activities) {
    for (const dep of act.dependencies) {
      if (!activityMap.has(dep.predecessorId)) continue;
      const list = adjList.get(dep.predecessorId);
      if (list) list.push(act.id);
    }
  }

  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    for (const neighbor of adjList.get(nodeId) ?? []) {
      const neighborColor = color.get(neighbor);

      if (neighborColor === GRAY) {
        // Found a cycle - mark all nodes in the cycle
        const cycleStart = path.indexOf(neighbor);
        for (let i = cycleStart; i < path.length; i++) {
          cycleMembers.add(path[i]);
        }
        cycleMembers.add(neighbor);
        return true;
      }

      if (neighborColor === WHITE) {
        if (dfs(neighbor)) return true;
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
    return false;
  }

  for (const act of activities) {
    if (color.get(act.id) === WHITE) {
      dfs(act.id);
    }
  }

  for (const id of cycleMembers) {
    const act = activityMap.get(id);
    conflicts.push({
      activityId: id,
      type: 'circular_dependency',
      message: `Activity "${act?.name ?? id}" is part of a circular dependency chain.`,
    });
  }

  return conflicts;
}

/**
 * Detect activities with negative float (over-constrained schedule).
 */
export function detectNegativeFloat(activities: Activity[]): Conflict[] {
  const cpmResults = computeCriticalPath(activities);
  const activityMap = new Map<string, Activity>();
  for (const act of activities) {
    activityMap.set(act.id, act);
  }

  return cpmResults
    .filter((r) => r.totalFloat < -1e-9)
    .map((r) => {
      const act = activityMap.get(r.activityId);
      return {
        activityId: r.activityId,
        type: 'negative_float' as const,
        message: `Activity "${act?.name ?? r.activityId}" has negative float (${r.totalFloat.toFixed(1)} months), indicating an over-constrained schedule.`,
      };
    });
}

/**
 * Detect activities referencing non-existent predecessors.
 */
export function detectMissingPredecessors(
  activities: Activity[],
  milestones: Milestone[] = [],
): Conflict[] {
  const activityIds = new Set(activities.map((a) => a.id));
  const milestoneIds = new Set(milestones.map((m) => m.id));
  const conflicts: Conflict[] = [];

  for (const act of activities) {
    for (const dep of act.dependencies) {
      if (!activityIds.has(dep.predecessorId) && !milestoneIds.has(dep.predecessorId)) {
        conflicts.push({
          activityId: act.id,
          type: 'missing_predecessor',
          message: `Activity "${act.name}" references non-existent predecessor "${dep.predecessorId}".`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Run all conflict detection checks and return combined results.
 */
export function detectAllConflicts(
  activities: Activity[],
  milestones: Milestone[] = [],
): Conflict[] {
  return [
    ...detectCircularDependencies(activities),
    ...detectNegativeFloat(activities),
    ...detectMissingPredecessors(activities, milestones),
  ];
}
