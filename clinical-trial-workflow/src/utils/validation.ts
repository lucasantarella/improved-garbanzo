import { ExportPayloadSchema } from '@/types/schema';
import type { ExportPayload } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an imported JSON string against the workflow schema and check
 * referential integrity and temporal consistency.
 *
 * Steps:
 * 1. Parse JSON string.
 * 2. Validate against ExportPayloadSchema (Zod).
 * 3. Check referential integrity:
 *    - All activity swimLaneId references point to existing swim lanes.
 *    - All dependency predecessorId references point to existing activities.
 *    - All milestoneGateId references point to existing milestones.
 *    - All milestone swimLaneId references point to existing swim lanes.
 *    - All activity tag references point to existing tags.
 * 4. Check temporal consistency:
 *    - endMonth === startMonth + durationMonths for each activity.
 * 5. Return { valid, errors, warnings }.
 */
export function validateImport(jsonString: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
      warnings: [],
    };
  }

  // Step 2: Validate against Zod schema
  const zodResult = ExportPayloadSchema.safeParse(parsed);
  if (!zodResult.success) {
    const zodErrors = zodResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return {
      valid: false,
      errors: zodErrors,
      warnings: [],
    };
  }

  const payload = zodResult.data as unknown as ExportPayload;
  const { workflowTemplate } = payload;

  // Build lookup sets
  const swimLaneIds = new Set(workflowTemplate.swimLanes.map((sl) => sl.id));
  const activityIds = new Set(workflowTemplate.activities.map((a) => a.id));
  const milestoneIds = new Set(workflowTemplate.milestones.map((m) => m.id));
  const tagIds = new Set(workflowTemplate.tags.map((t) => t.id));

  // Step 3: Referential integrity checks

  // Check activity swimLaneId references
  for (const activity of workflowTemplate.activities) {
    if (!swimLaneIds.has(activity.swimLaneId)) {
      errors.push(
        `Activity "${activity.name}" (${activity.id}) references non-existent swim lane "${activity.swimLaneId}".`,
      );
    }

    // Check dependency predecessorId references
    for (const dep of activity.dependencies) {
      if (!activityIds.has(dep.predecessorId)) {
        errors.push(
          `Activity "${activity.name}" (${activity.id}) has dependency on non-existent predecessor "${dep.predecessorId}".`,
        );
      }

      // Warn on self-references
      if (dep.predecessorId === activity.id) {
        errors.push(
          `Activity "${activity.name}" (${activity.id}) has a self-referencing dependency.`,
        );
      }
    }

    // Check milestoneGateId references
    if (activity.milestoneGateId !== null && !milestoneIds.has(activity.milestoneGateId)) {
      errors.push(
        `Activity "${activity.name}" (${activity.id}) references non-existent milestone gate "${activity.milestoneGateId}".`,
      );
    }

    // Check tag references
    for (const tagId of activity.tags) {
      if (!tagIds.has(tagId)) {
        warnings.push(
          `Activity "${activity.name}" (${activity.id}) references non-existent tag "${tagId}".`,
        );
      }
    }
  }

  // Check milestone swimLaneId references
  for (const milestone of workflowTemplate.milestones) {
    if (!swimLaneIds.has(milestone.swimLaneId)) {
      errors.push(
        `Milestone "${milestone.name}" (${milestone.id}) references non-existent swim lane "${milestone.swimLaneId}".`,
      );
    }
  }

  // Step 4: Temporal consistency checks
  for (const activity of workflowTemplate.activities) {
    const expectedEnd = activity.startMonth + activity.durationMonths;
    if (Math.abs(activity.endMonth - expectedEnd) > 0.001) {
      errors.push(
        `Activity "${activity.name}" (${activity.id}) has inconsistent timing: ` +
          `endMonth (${activity.endMonth}) !== startMonth (${activity.startMonth}) + durationMonths (${activity.durationMonths}) = ${expectedEnd}.`,
      );
    }

    // Warn on zero-duration non-milestone activities
    if (activity.durationMonths === 0 && activity.milestoneGateId === null) {
      warnings.push(
        `Activity "${activity.name}" (${activity.id}) has zero duration but is not linked to a milestone gate.`,
      );
    }

    // Warn on negative duration
    if (activity.durationMonths < 0) {
      errors.push(
        `Activity "${activity.name}" (${activity.id}) has negative duration (${activity.durationMonths}).`,
      );
    }
  }

  // Check for duplicate IDs
  const allActivityIds: string[] = workflowTemplate.activities.map((a) => a.id);
  const duplicateActivityIds = allActivityIds.filter(
    (id, index) => allActivityIds.indexOf(id) !== index,
  );
  for (const dupId of new Set(duplicateActivityIds)) {
    errors.push(`Duplicate activity ID found: "${dupId}".`);
  }

  const allSwimLaneIds: string[] = workflowTemplate.swimLanes.map((sl) => sl.id);
  const duplicateSwimLaneIds = allSwimLaneIds.filter(
    (id, index) => allSwimLaneIds.indexOf(id) !== index,
  );
  for (const dupId of new Set(duplicateSwimLaneIds)) {
    errors.push(`Duplicate swim lane ID found: "${dupId}".`);
  }

  const allMilestoneIds: string[] = workflowTemplate.milestones.map((m) => m.id);
  const duplicateMilestoneIds = allMilestoneIds.filter(
    (id, index) => allMilestoneIds.indexOf(id) !== index,
  );
  for (const dupId of new Set(duplicateMilestoneIds)) {
    errors.push(`Duplicate milestone ID found: "${dupId}".`);
  }

  // Check time range consistency
  if (workflowTemplate.timeConfig.rangeStart >= workflowTemplate.timeConfig.rangeEnd) {
    warnings.push(
      `Time config rangeStart (${workflowTemplate.timeConfig.rangeStart}) should be less than rangeEnd (${workflowTemplate.timeConfig.rangeEnd}).`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
