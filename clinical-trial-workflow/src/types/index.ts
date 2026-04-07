export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type GateType = 'approval' | 'review' | 'informational';
export type TimeUnit = 'month' | 'week' | 'day';
export type ViewMode = 'gantt' | 'table';
export type CustomFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';

export interface TimeConfig {
  unit: TimeUnit;
  calendarDaysPerUnit: number;
  originLabel: string;
  rangeStart: number;
  rangeEnd: number;
}

export interface SwimLane {
  id: string;
  name: string;
  shortName: string;
  color: string;
  order: number;
  department: string;
  isCollapsible: boolean;
  isVisible: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  abbreviation: string;
  month: number;
  isCriticalPath: boolean;
  swimLaneId: string;
  description: string;
  gateType: GateType;
  gateApprovers: string[];
  dependencies: Dependency[];
}

export interface Dependency {
  predecessorId: string;
  type: DependencyType;
  lagMonths: number;
}

export interface Activity {
  id: string;
  name: string;
  swimLaneId: string;
  startMonth: number;
  durationMonths: number;
  endMonth: number;
  isCriticalPath: boolean;
  isOptional: boolean;
  isContinuous: boolean;
  dependencies: Dependency[];
  milestoneGateId: string | null;
  description: string;
  tags: string[];
  outputs: string[];
  inputs: string[];
  owner: string;
  estimatedEffortDays: number | null;
  notes: string;
  customFields: Record<string, unknown>;
}

export type MetricPointType = 'start' | 'end';

export interface CycleTimeMetric {
  id: string;
  name: string;
  fromActivityId: string;
  fromPoint: MetricPointType;
  toActivityId: string;
  toPoint: MetricPointType;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  client: string;
  timeConfig: TimeConfig;
  swimLanes: SwimLane[];
  milestones: Milestone[];
  activities: Activity[];
  tags: Tag[];
  cycleTimeMetrics: CycleTimeMetric[];
  customFieldDefinitions: CustomFieldDefinition[];
}

export interface ExportPayload {
  $schema: string;
  exportedAt: string;
  exportedBy: string;
  workflowTemplate: WorkflowTemplate;
}

export interface FilterState {
  swimLaneIds: string[];
  tagIds: string[];
  searchQuery: string;
  criticalPathOnly: boolean;
  timeRange: [number, number] | null;
}

export interface Conflict {
  activityId: string;
  type: 'circular_dependency' | 'negative_float' | 'missing_predecessor';
  message: string;
}
