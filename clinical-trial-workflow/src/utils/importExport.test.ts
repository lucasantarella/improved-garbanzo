import { describe, it, expect } from 'vitest';
import { jazzPharmaTemplate } from '@/data/jazzPharmaTemplate';
import { validateImport } from '@/utils/validation';
import { ExportPayloadSchema } from '@/types/schema';
import type { WorkflowTemplate, ExportPayload } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function structuredCloneTemplate(t: WorkflowTemplate): WorkflowTemplate {
  return JSON.parse(JSON.stringify(t));
}

function buildExportPayload(template: WorkflowTemplate): ExportPayload {
  return {
    $schema: 'https://jazz-pharma.com/schemas/workflow-template/v1',
    exportedAt: new Date().toISOString(),
    exportedBy: template.author || 'unknown',
    workflowTemplate: structuredCloneTemplate(template),
  };
}

function exportAndReimport(template: WorkflowTemplate) {
  const payload = buildExportPayload(template);
  const json = JSON.stringify(payload, null, 2);
  return validateImport(json);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Import/Export round-trip', () => {
  it('default template round-trips without errors', () => {
    const result = exportAndReimport(jazzPharmaTemplate);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('exported JSON passes Zod schema validation', () => {
    const payload = buildExportPayload(jazzPharmaTemplate);
    const json = JSON.stringify(payload, null, 2);
    const parsed = JSON.parse(json);
    const zodResult = ExportPayloadSchema.safeParse(parsed);
    expect(zodResult.success).toBe(true);
  });

  it('re-parsed template has identical activity count', () => {
    const payload = buildExportPayload(jazzPharmaTemplate);
    const json = JSON.stringify(payload, null, 2);
    const parsed: ExportPayload = JSON.parse(json);
    expect(parsed.workflowTemplate.activities.length).toBe(
      jazzPharmaTemplate.activities.length,
    );
  });

  it('re-parsed template has identical milestone count', () => {
    const payload = buildExportPayload(jazzPharmaTemplate);
    const json = JSON.stringify(payload, null, 2);
    const parsed: ExportPayload = JSON.parse(json);
    expect(parsed.workflowTemplate.milestones.length).toBe(
      jazzPharmaTemplate.milestones.length,
    );
  });

  it('re-parsed template has identical swim lane count', () => {
    const payload = buildExportPayload(jazzPharmaTemplate);
    const json = JSON.stringify(payload, null, 2);
    const parsed: ExportPayload = JSON.parse(json);
    expect(parsed.workflowTemplate.swimLanes.length).toBe(
      jazzPharmaTemplate.swimLanes.length,
    );
  });
});

describe('Round-trip with day-level edits', () => {
  it('activities with 1/30-month (day) snapped values round-trip', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    // Simulate day-level snapping on the first 20 activities
    for (let i = 0; i < 20; i++) {
      const a = template.activities[i];
      a.startMonth = Math.round(a.startMonth * 30 + i) / 30;
      a.durationMonths = Math.round(a.durationMonths * 30 + i) / 30;
      a.endMonth = a.startMonth + a.durationMonths;
    }

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('activities with very small durations (1 day) round-trip', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].durationMonths = 1 / 30; // 1 day
    template.activities[0].endMonth =
      template.activities[0].startMonth + template.activities[0].durationMonths;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('temporal consistency holds after JSON round-trip with fractional months', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    // Use values that are tricky for floating-point
    const a = template.activities[0];
    a.startMonth = 7 / 30; // 0.23333...
    a.durationMonths = 13 / 30; // 0.43333...
    a.endMonth = a.startMonth + a.durationMonths;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('Round-trip with user edits (edge cases)', () => {
  it('activity with empty name round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].name = '';

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('activity with zero duration round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].durationMonths = 0;
    template.activities[0].endMonth = template.activities[0].startMonth;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
  });

  it('newly added activity round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities.push({
      id: 'act-new-001',
      name: 'New Activity',
      swimLaneId: template.swimLanes[0].id,
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
    });

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('added dependency round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[5].dependencies.push({
      predecessorId: template.activities[0].id,
      type: 'FS',
      lagMonths: 0.5,
    });

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('added milestone round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.milestones.push({
      id: 'ms-new-001',
      name: 'New Milestone',
      abbreviation: 'NM',
      month: 5,
      isCriticalPath: false,
      swimLaneId: template.swimLanes[0].id,
      description: '',
      gateType: 'informational',
      gateApprovers: [],
      dependencies: [],
    });

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('added swim lane round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.swimLanes.push({
      id: 'sl-new-001',
      name: 'New Lane',
      shortName: 'NewLane',
      color: '#ff5500',
      order: 99,
      department: 'New Department',
      isCollapsible: true,
      isVisible: true,
    });

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('Cycle time metrics round-trip', () => {
  it('template with cycle time metrics round-trips', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.cycleTimeMetrics = [
      {
        id: 'metric-001',
        name: 'IND to FPD',
        fromActivityId: template.activities[0].id,
        fromPoint: 'end',
        toActivityId: template.activities[10].id,
        toPoint: 'start',
      },
    ];

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('metric with missing activity reference produces warning', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.cycleTimeMetrics = [
      {
        id: 'metric-002',
        name: 'Bad Ref',
        fromActivityId: 'nonexistent',
        fromPoint: 'start',
        toActivityId: template.activities[0].id,
        toPoint: 'end',
      },
    ];

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true); // warnings, not errors
    expect(result.warnings.some((w) => w.includes('non-existent'))).toBe(true);
  });

  it('multiple metrics round-trip', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.cycleTimeMetrics = [
      {
        id: 'metric-a',
        name: 'Metric A',
        fromActivityId: template.activities[0].id,
        fromPoint: 'start',
        toActivityId: template.activities[5].id,
        toPoint: 'end',
      },
      {
        id: 'metric-b',
        name: 'Metric B',
        fromActivityId: template.activities[5].id,
        fromPoint: 'end',
        toActivityId: template.activities[20].id,
        toPoint: 'start',
      },
    ];

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);

    const parsed: ExportPayload = JSON.parse(
      JSON.stringify(buildExportPayload(template)),
    );
    expect(parsed.workflowTemplate.cycleTimeMetrics.length).toBe(2);
  });

  it('template without cycleTimeMetrics field imports (backward compat)', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (template as any).cycleTimeMetrics;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(true);
  });
});

describe('Validation catches real errors', () => {
  it('rejects invalid JSON', () => {
    const result = validateImport('not json{{{');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects missing workflowTemplate', () => {
    const result = validateImport(
      JSON.stringify({ $schema: 'x', exportedAt: 'x', exportedBy: 'x' }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects activity with non-existent swimLaneId', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].swimLaneId = 'nonexistent-lane';

    const result = exportAndReimport(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-existent swim lane'))).toBe(
      true,
    );
  });

  it('rejects dependency on non-existent predecessor', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].dependencies.push({
      predecessorId: 'nonexistent-id',
      type: 'FS',
      lagMonths: 0,
    });

    const result = exportAndReimport(template);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('non-existent predecessor')),
    ).toBe(true);
  });

  it('rejects inconsistent endMonth', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].endMonth = 999; // wrong

    const result = exportAndReimport(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('inconsistent timing'))).toBe(
      true,
    );
  });

  it('rejects negative duration', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[0].durationMonths = -1;
    template.activities[0].endMonth =
      template.activities[0].startMonth + template.activities[0].durationMonths;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate activity IDs', () => {
    const template = structuredCloneTemplate(jazzPharmaTemplate);
    template.activities[1].id = template.activities[0].id;

    const result = exportAndReimport(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate activity ID'))).toBe(
      true,
    );
  });
});
