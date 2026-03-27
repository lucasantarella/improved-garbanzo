import { z } from 'zod';

const DependencySchema = z.object({
  predecessorId: z.string(),
  type: z.enum(['FS', 'SS', 'FF', 'SF']),
  lagMonths: z.number(),
});

const ActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  swimLaneId: z.string(),
  startMonth: z.number(),
  durationMonths: z.number().min(0),
  endMonth: z.number(),
  isCriticalPath: z.boolean(),
  isOptional: z.boolean(),
  isContinuous: z.boolean(),
  dependencies: z.array(DependencySchema),
  milestoneGateId: z.string().nullable(),
  description: z.string(),
  tags: z.array(z.string()),
  outputs: z.array(z.string()),
  inputs: z.array(z.string()),
  owner: z.string(),
  estimatedEffortDays: z.number().nullable(),
  notes: z.string(),
  customFields: z.record(z.string(), z.unknown()),
});

const SwimLaneSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().min(0),
  department: z.string(),
  isCollapsible: z.boolean(),
  isVisible: z.boolean(),
});

const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
  month: z.number(),
  isCriticalPath: z.boolean(),
  swimLaneId: z.string(),
  description: z.string(),
  gateType: z.enum(['approval', 'review', 'informational']),
  gateApprovers: z.array(z.string()),
});

const TimeConfigSchema = z.object({
  unit: z.enum(['month', 'week', 'day']),
  calendarDaysPerUnit: z.number().positive(),
  originLabel: z.string(),
  rangeStart: z.number(),
  rangeEnd: z.number(),
});

const CycleTimeMetricSchema = z.object({
  id: z.string(),
  name: z.string(),
  fromActivityId: z.string(),
  fromPoint: z.enum(['start', 'end']),
  toActivityId: z.string(),
  toPoint: z.enum(['start', 'end']),
});

const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

const CustomFieldDefSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'select', 'multiselect', 'boolean', 'date']),
  options: z.array(z.string()).optional(),
});

export const WorkflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.string(),
  client: z.string(),
  timeConfig: TimeConfigSchema,
  swimLanes: z.array(SwimLaneSchema).min(1),
  milestones: z.array(MilestoneSchema),
  activities: z.array(ActivitySchema),
  tags: z.array(TagSchema),
  cycleTimeMetrics: z.array(CycleTimeMetricSchema).optional().default([]),
  customFieldDefinitions: z.array(CustomFieldDefSchema),
});

export const ExportPayloadSchema = z.object({
  $schema: z.string(),
  exportedAt: z.string(),
  exportedBy: z.string(),
  workflowTemplate: WorkflowTemplateSchema,
});
