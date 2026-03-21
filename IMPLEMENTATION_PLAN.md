# Clinical Trial Workflow Editor — Phase 1 Implementation Plan

> **Purpose**: Step-by-step implementation guide for Claude Code to build the Phase 1 Interactive Workflow Editor.
> **Design Reference**: `Clinical_Trial_Workflow_System_Design.html` (same directory)
> **Source Data**: `E2E Clinical Trial Process Map_Accelerated_Sep 2023.pdf`

---

## Project Overview

Build a React SPA that lets a consultant and pharma client collaboratively edit a clinical trial workflow (229 activities, 24 milestones, 12 swim lanes) with both Gantt and Table views, exporting the result as a JSON template for downstream project instantiation.

**Key constraints:**
- Fully client-side — no backend, no database
- JSON file is the persistence layer (import/export)
- Pre-loaded with Jazz Pharmaceuticals' accelerated E2E process
- Must support undo/redo for live collaborative editing sessions
- Minimum viewport: 1280px wide

---

## Step 0: Project Scaffolding

### 0.1 Initialize the project

```bash
npm create vite@latest clinical-trial-workflow -- --template react-ts
cd clinical-trial-workflow
```

### 0.2 Install all dependencies

```bash
# Core UI
npm install zustand immer
npm install @tanstack/react-table @tanstack/react-virtual
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install tailwindcss @tailwindcss/vite
npm install lucide-react
npm install zod
npm install uuid
npm install @types/uuid -D
```

### 0.3 Configure Tailwind

In `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

In `src/index.css`:
```css
@import "tailwindcss";
```

### 0.4 Set up directory structure

```
src/
├── App.tsx                    # Root layout
├── main.tsx                   # Entry point
├── index.css                  # Tailwind import
├── types/
│   ├── index.ts               # All TypeScript interfaces
│   └── schema.ts              # Zod validation schemas
├── store/
│   ├── workflowStore.ts       # Zustand store
│   └── undoMiddleware.ts      # Temporal undo/redo middleware
├── data/
│   └── jazzPharmaTemplate.ts  # Pre-loaded template data (229 activities)
├── utils/
│   ├── criticalPath.ts        # CPM algorithm
│   ├── validation.ts          # JSON import validation
│   ├── idGenerator.ts         # UUID helper
│   └── timeUtils.ts           # Month ↔ display label conversions
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx
│   │   ├── FilterBar.tsx
│   │   └── StatusBar.tsx
│   ├── gantt/
│   │   ├── GanttView.tsx           # Main Gantt container
│   │   ├── TimelineHeader.tsx      # Month columns with zoom
│   │   ├── SwimLaneGroup.tsx       # Collapsible lane group
│   │   ├── ActivityBar.tsx         # Draggable bar
│   │   ├── MilestoneMarker.tsx     # Diamond marker
│   │   ├── DependencyArrows.tsx    # SVG overlay
│   │   └── CriticalPathOverlay.tsx # Highlight layer
│   ├── table/
│   │   ├── TableView.tsx           # Main table container
│   │   ├── EditableCell.tsx        # Inline editable cell
│   │   ├── DependencyChips.tsx     # Dependency display/edit
│   │   └── TagChips.tsx            # Tag display/edit
│   ├── shared/
│   │   ├── ActivityDetailPanel.tsx # Slide-out detail drawer
│   │   ├── DependencyEditor.tsx    # Dependency add/remove modal
│   │   ├── ViewToggle.tsx          # Gantt/Table toggle
│   │   ├── JsonImportExport.tsx    # File I/O buttons
│   │   └── ConfirmDialog.tsx       # Delete confirmation
│   └── ui/                         # Reusable primitives (button, dropdown, etc.)
│       ├── Button.tsx
│       ├── Dropdown.tsx
│       ├── Modal.tsx
│       ├── Tooltip.tsx
│       └── Badge.tsx
└── hooks/
    ├── useKeyboardShortcuts.ts
    └── useActivityFilters.ts
```

Create all directories and placeholder files:

```bash
mkdir -p src/{types,store,data,utils,components/{layout,gantt,table,shared,ui},hooks}
```

### 0.5 Verification

Run `npm run dev` and confirm the Vite dev server starts with no errors and shows the default React page.

---

## Step 1: TypeScript Types & Zod Schemas

### 1.1 Create `src/types/index.ts`

Define all interfaces. These are the canonical type definitions for the entire app.

```ts
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type GateType = 'approval' | 'review' | 'informational';
export type TimeUnit = 'month' | 'week' | 'day';
export type ViewMode = 'gantt' | 'table';
export type CustomFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';

export interface TimeConfig {
  unit: TimeUnit;
  calendarDaysPerUnit: number;
  originLabel: string;       // What month 0 represents (e.g. "IND Submission")
  rangeStart: number;        // e.g. -7
  rangeEnd: number;          // e.g. 29
}

export interface SwimLane {
  id: string;
  name: string;
  shortName: string;
  color: string;             // Hex color
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
}

export interface Dependency {
  predecessorId: string;     // Activity or Milestone ID
  type: DependencyType;
  lagMonths: number;
}

export interface Activity {
  id: string;
  name: string;
  swimLaneId: string;
  startMonth: number;
  durationMonths: number;
  endMonth: number;          // Computed: startMonth + durationMonths
  isCriticalPath: boolean;
  isOptional: boolean;
  isContinuous: boolean;     // Ongoing activity with no fixed end
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
  customFieldDefinitions: CustomFieldDefinition[];
}

export interface ExportPayload {
  $schema: string;
  exportedAt: string;
  exportedBy: string;
  workflowTemplate: WorkflowTemplate;
}

// Store-specific types
export interface FilterState {
  swimLaneIds: string[];     // Empty = show all
  tagIds: string[];          // Empty = show all
  searchQuery: string;
  criticalPathOnly: boolean;
  timeRange: [number, number] | null;
}

export interface Conflict {
  activityId: string;
  type: 'circular_dependency' | 'negative_float' | 'missing_predecessor';
  message: string;
}
```

### 1.2 Create `src/types/schema.ts`

Zod schemas for runtime validation of imported JSON files.

```ts
import { z } from 'zod';

const DependencySchema = z.object({
  predecessorId: z.string(),
  type: z.enum(['FS', 'SS', 'FF', 'SF']),
  lagMonths: z.number(),
});

const ActivitySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
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
  customFields: z.record(z.unknown()),
});

const SwimLaneSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  shortName: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  order: z.number().int().min(0),
  department: z.string(),
  isCollapsible: z.boolean(),
  isVisible: z.boolean(),
});

const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
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
  name: z.string().min(1),
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
  customFieldDefinitions: z.array(CustomFieldDefSchema),
});

export const ExportPayloadSchema = z.object({
  $schema: z.string(),
  exportedAt: z.string(),
  exportedBy: z.string(),
  workflowTemplate: WorkflowTemplateSchema,
});
```

### 1.3 Verification

Create a simple test: import the types in `App.tsx`, ensure `npm run dev` compiles with no TS errors.

---

## Step 2: Pre-loaded Template Data

### 2.1 Create `src/data/jazzPharmaTemplate.ts`

This is the largest single file. It contains the full Jazz Pharmaceuticals accelerated E2E clinical trial process, transcribed from the PDF into the `WorkflowTemplate` structure.

**IMPORTANT**: This file must contain ALL 229 activities, 24 milestones, and 12+1 swim lanes. The data must be carefully structured with reasonable `startMonth` and `durationMonths` values derived from the PDF's visual timeline.

**Source reference**: The PDF shows a Gantt chart spanning month -7 to month +29 where each labeled month on the chart represents approximately 4.3 calendar weeks. The time axis labels from the PDF are: `-1 Month, 0, +1 Month, +2 Months, ... +10 Months, Q4, Q5, Q6, Q7, +23 Months, +24 Months, ... +29 Months`. Note that Q4 through Q7 represent quarters (3-month blocks) covering roughly months 11-22.

Structure the file as:

```ts
import { WorkflowTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const jazzPharmaTemplate: WorkflowTemplate = {
  id: uuidv4(),
  name: "Accelerated Clinical Trial E2E — Phase II/III",
  version: "1.0.0",
  description: "End-to-end process from Portfolio Prioritization through CSR. Derived from Jazz Pharmaceuticals accelerated clinical trial process map (Sep 2023).",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: "Luca — DocSpera Consulting",
  client: "Jazz Pharmaceuticals",
  timeConfig: { ... },
  swimLanes: [ ... ],   // 13 lanes
  milestones: [ ... ],   // 24 milestones
  activities: [ ... ],   // 229 activities
  tags: [ ... ],
  customFieldDefinitions: [ ... ],
};
```

Below is the complete data to include. Use stable IDs (not random UUIDs) so that dependencies can reference them — use the format `sl-001`, `ms-001`, `act-001`, etc.

#### Swim Lanes (13 total)

| ID | Name | Short Name | Color | Order | Department |
|----|------|-----------|-------|-------|------------|
| sl-001 | Key Milestones | Milestones | #3b82f6 | 0 | Cross-functional |
| sl-002 | Clinical Development | ClinDev | #a3e635 | 1 | Clinical Development |
| sl-003 | Medical Writing | MedWrite | #c084fc | 2 | Medical Writing |
| sl-004 | Regulatory | Regulatory | #60a5fa | 3 | Regulatory Affairs |
| sl-005 | Clinical Operations & CRO | ClinOps | #f472b6 | 4 | Clinical Operations |
| sl-006 | Clinical Outsourcing & Innovation | Outsourcing | #fb7185 | 5 | Clinical Outsourcing |
| sl-007 | Clinical Supplies | Supplies | #fbbf24 | 6 | Clinical Supplies |
| sl-008 | CMC | CMC | #34d399 | 7 | Chemistry Manufacturing Controls |
| sl-009 | Clinical Data Operations | DataOps | #fb923c | 8 | Data Operations |
| sl-010 | Data Science | DataSci | #818cf8 | 9 | Data Science |
| sl-011 | Safety | Safety | #facc15 | 10 | Drug Safety |
| sl-012 | Project Management | ProjMgmt | #9ca3af | 11 | Project Management |
| sl-013 | Quality | Quality | #d1d5db | 12 | Quality Assurance |

#### Milestones (24 total)

| ID | Name | Abbr | Month | Critical | Gate Type |
|----|------|------|-------|----------|-----------|
| ms-001 | Portfolio Prioritization | PP | -7 | true | approval |
| ms-002 | PGC Approval | PGC | -6 | true | approval |
| ms-003 | DPRC Review | DPRC | -5 | true | review |
| ms-004 | CTWG Kickoff | CTWG | -5 | false | informational |
| ms-005 | PRC1 Approval | PRC1 | -4 | true | approval |
| ms-006 | All Sites Selected | Sites | -3 | false | informational |
| ms-007 | Start-up Work Order for CRO | CRO-WO | -3 | true | approval |
| ms-008 | Protocol Finalized | Proto | -2 | true | approval |
| ms-009 | Update IND & CTA | IND-Up | -2 | true | review |
| ms-010 | IND 30-Day Review Complete (US) | IND-30 | -1 | true | approval |
| ms-011 | PRC2 Approval | PRC2 | 0 | true | approval |
| ms-012 | First IRB Approval | IRB1 | 1 | true | approval |
| ms-013 | Authorization to Ship IMP | Ship | 1 | true | approval |
| ms-014 | 1st Site Activated | Site1 | 2 | true | informational |
| ms-015 | FPS (First Person Screened) | FPS | 2 | true | informational |
| ms-016 | FPE (First Patient Enrolled) | FPE | 2 | true | informational |
| ms-017 | FPD (First Patient Dosed) | FPD | 3 | true | informational |
| ms-018 | 25% Enrollment Target | Enr25 | 4 | false | informational |
| ms-019 | 80% of Sites Activated | Sites80 | 5 | false | informational |
| ms-020 | 75% Enrollment Target | Enr75 | 9 | false | informational |
| ms-021 | LPD (Last Patient Dosed) | LPD | 18 | true | informational |
| ms-022 | LPLV (Last Patient Last Visit) | LPLV | 23 | true | informational |
| ms-023 | DBL / Final Data Transfer | DBL | 25 | true | approval |
| ms-024 | TLR (Top Line Results) | TLR | 26 | true | informational |
| ms-025 | TFL (Tables, Figures, Listings) | TFL | 28 | true | informational |
| ms-026 | CSR (Clinical Study Report) | CSR | 29 | true | approval |

#### Activities (229 total)

This is the most labor-intensive data entry. Below is the full list organized by swim lane. Each activity needs: `id`, `name`, `swimLaneId`, `startMonth`, `durationMonths`, `endMonth` (computed), `isCriticalPath`, `isOptional`, `isContinuous`, `dependencies` (array — can be empty initially), `milestoneGateId` (null if none), `description` (brief), `tags` (array of tag names), `outputs` (array), `inputs` (array), `owner` (swim lane department), `estimatedEffortDays` (null), `notes` (""), `customFields` ({}).

**For the initial build, populate with the data below. Dependencies can start sparse and be refined iteratively with the client.**

Include ALL activities listed below, grouped by swim lane. Use sequential IDs: `act-001` through `act-229`.

**Clinical Development (17 activities, sl-002):**
1. Develop TPP draft and align @CDT — start: -7, dur: 2
2. Create Development Strategy — start: -6, dur: 2
3. Study Outline Draft — start: -6, dur: 1
4. Develop Study Outline — start: -5, dur: 2
5. Develop Package for DPRC — start: -5, dur: 1
6. Identify and develop/update IB as needed — start: -5, dur: 3
7. Set up DMC and/or Steering Committees — start: -4, dur: 2
8. Conduct KOL Advisory Boards — start: -4, dur: 2
9. Conduct Patient & Site Advisory Boards — start: -4, dur: 2
10. Develop Protocol — start: -4, dur: 3
11. Perform IRT UAT and Approve - Go live — start: -1, dur: 1
12. Perform medical monitoring — start: 2, dur: 21
13. Do ongoing data review from medical perspective — start: 2, dur: 21
14. Review/confirm patient eligibility — start: 2, dur: 16
15. Lead protocol amendments — start: 3, dur: 15
16. Monitor trial conduct for risks — start: 2, dur: 21
17. Present topline data results to EC — start: 26, dur: 1

**Medical Writing (8 activities, sl-003):**
18. Storyboard Development and Approval (Protocol) — start: -4, dur: 2
19. Storyboard Development and Approval (IND Update) — start: -2, dur: 1
20. Develop briefing package (pre-DPRC) — start: -5, dur: 1
21. Develop briefing package (pre-Agency) — start: -2, dur: 1
22. Storyboard Development and Approval (CSR) — start: 25, dur: 2
23. Develop and finalize CSR — start: 26, dur: 3
24. Develop briefing package (post-study) — start: 26, dur: 2
25. Support Med Writing as needed for the CSR — start: 25, dur: 4

**Regulatory (17 activities, sl-004):**
26. ID & name team for post-PGC approval — start: -6, dur: 1
27. Determine if agency input is required (US/EU) — start: -6, dur: 1
28. Prepare CTA (IMPD) — start: -4, dur: 3
29. Update IND — start: -3, dur: 2
30. Label (English Master) Specification review/Approval — start: -3, dur: 2
31. 30-day IND review period — start: -1, dur: 1
32. Receive & respond to EU agency questions — start: -1, dur: 2
33. EU Agency Approval — start: 0, dur: 1
34. Submit documents to Health Authorities — start: -1, dur: 1
35. Maintain posting to clinicaltrials.gov — start: 1, dur: 28
36. Continue ongoing Regulatory updates — start: 1, dur: 22
37. Management of Amendment to competent authorities — start: 3, dur: 20
38. End of trial notification to Regulatory Agencies — start: 23, dur: 1
39. Ensure TMF sections complete (Regulatory) — start: 23, dur: 3
40. Regulatory Interactions with Agency — start: 27, dur: 2
41. Jazz Final Label approval after translations — start: -1, dur: 1
42. Briefing Package sent to Agency — start: 26, dur: 1

**Clinical Operations & CRO (53 activities, sl-005):**
43. Non-study specific enablers of rapid start-up — start: -7, dur: 7
44. EDC standards/IRT standards/Database of investigators/MSAs — start: -7, dur: 7
45. Central IRB Approval (US) — start: -2, dur: 2
46. Work with CRO Regulatory for CA submissions — start: -2, dur: 4
47. ID desired vendors — start: -6, dur: 1
48. Develop Site List — start: -5, dur: 1
49. Create List of Potential Sites — start: -6, dur: 1
50. Develop timeline and cost estimates with CROs — start: -5, dur: 2
51. Develop Patient & Data Journey — start: -3, dur: 2
52. Site ID, feasibility and selection — start: -4, dur: 4
53. First Site Feasibility — start: -4, dur: 1
54. Finalize Site List — start: -2, dur: 1
55. Develop Trial Oversight Plan — start: -3, dur: 2
56. Develop Master ICF — start: -3, dur: 2
57. Develop Country ICFs for all sites — start: -1, dur: 3
58. Collect Essential Documents - US — start: -2, dur: 2
59. Collect Essential Documents - Ex-US — start: -1, dur: 3
60. Perform ICF Translations (Country) — start: 0, dur: 2
61. EC, IRB Submissions and Approvals - Ex-US — start: 0, dur: 4
62. IRB Submissions and Approvals - US — start: -1, dur: 2
63. Site Initiation Visit — start: 1, dur: 4
64. First site CTA / Budget fully executed — start: 0, dur: 1
65. Authorization to Ship IMP — start: 1, dur: 1
66. Conduct Investigator Meeting — start: 1, dur: 1
67. Begin Pre-Screening Patients — start: 1, dur: 1
68. Ensure sites performing patient visit/data entry — start: 2, dur: 21
69. Ensure Insurance/Indemnification Ready — start: -2, dur: 2
70. TMF Index & Plan Final — start: -2, dur: 1
71. Set up TMF (ClinOps) — start: -1, dur: 2
72. Lab Manual — start: -2, dur: 2
73. Pharmacy Manual — start: -2, dur: 2
74. RBQM: Identify critical data and processes — start: -3, dur: 2
75. RBQM: Document Risk Based Monitoring Strategy — start: -2, dur: 2
76. RBQM: Lead identification of critical/non-critical risks — start: -1, dur: 2
77. Prepare for Investigator Meeting - Logistics — start: -2, dur: 3
78. Prepare for Investigator Meeting - Content — start: -2, dur: 3
79. Import/Export/Controlled Drug Licenses from DEA — start: -1, dur: 2
80. Activate 1st Site in IRT System — start: 1, dur: 1
81. EC, IRB approval for most sites — start: 1, dur: 4
82. EC substantial/non-substantial Amendment management — start: 3, dur: 20
83. Facilitate DMC meetings — start: 3, dur: 20
84. Sample management & tracking — start: 3, dur: 20
85. Ensure ongoing supplies maintained — start: 2, dur: 21
86. Ensure TMF maintained throughout — start: 1, dur: 24
87. Ensure TMF sections complete (ClinOps) — start: 23, dur: 3
88. Complete all close out visits — start: 23, dur: 3
89. End of trial notifications to IRB/EC — start: 23, dur: 2
90. Final TMF Reconciliation — start: 25, dur: 2
91. Final IMV — start: 23, dur: 1
92. RBQM: Lead final approval of Risk Tool — start: 24, dur: 2
93. Get investigator signatures on CSR — start: 27, dur: 2
94. Collect PI Signatures (ClinOps) — start: 25, dur: 2
95. Oversee local drug destruction — start: 25, dur: 2

**Clinical Outsourcing & Innovation (39 activities, sl-006):**
96. Finalize CRO Management Plan — start: -5, dur: 2
97. RFP sent to CROs — start: -6, dur: 1
98. CRO Bid Defense — start: -5, dur: 1
99. CRO Selected/Awarded — start: -4, dur: 1
100. Execute Startup Work Order with CRO — start: -3, dur: 1
101. Execute full CRO Work Order — start: -2, dur: 1
102. On-board all critical path vendors — start: -3, dur: 3
103. Contract with central IRB — start: -4, dur: 1
104. Set up TMF (Outsourcing) — start: -2, dur: 2
105. Establish contracts with vendors — start: -4, dur: 3
106. Monthly Financial review — start: -3, dur: 32
107. Oversee CRO performance - deliverables/invoices — start: 0, dur: 29
108. Oversee CRO: centralized monitoring/metrics — start: 0, dur: 29
109. Pre-validated Scales / PROs Licensing — start: -4, dur: 2
110. Creation of Study Plans by CRO — start: -2, dur: 3
111. Ensure ongoing quality monitoring — start: 1, dur: 24
112. Complete Contracts for Investigator Meetings — start: -2, dur: 2
113. Set up CDAs for DMC and SC members — start: -3, dur: 2
114. Set up CDAs for KOL consultant agreements — start: -3, dur: 2
115. Contracting for advisory boards — start: -3, dur: 2
116. Funding Risk Approval assessment configuration — start: -2, dur: 1
117. Deploy coding — start: -1, dur: 1
118. Execute reports in CDF — start: 0, dur: 1
119. Program & QC data review listings in CDF — start: 0, dur: 2
120. Program & QC RBQM data outputs in CDF — start: 0, dur: 2
121. CDF out-of-the-box analytics go-live — start: 1, dur: 1
122. Deploy Recruitment metrics reports in JCI — start: 1, dur: 1
123. Deploy standard operations report in CDF/JCI — start: 1, dur: 1
124. Execute Site CDAs - Site Contracting FSP — start: -2, dur: 3
125. Enable CRO data transfers to Jazz / JCI dashboards — start: -1, dur: 2
126. Select and Execute Vendor Contracts (non-critical) — start: -3, dur: 2
127. Select and Contract IRT vendor — start: -5, dur: 2
128. Select and Contract Central Lab — start: -4, dur: 2
129. Select and Contract eCOA vendor — start: -4, dur: 2
130. Select and Contract EDC vendor — start: -4, dur: 2
131. Build site contract/budget templates — start: -3, dur: 3
132. Site Engagement Program — start: 0, dur: 5
133. Reconcile/closeout vendor contracts — start: 25, dur: 3
134. Reconcile budget/closeout site contracts — start: 25, dur: 3
135. Develop timelines for DMC, interim analyses — start: -2, dur: 3
136. Oversee CRO/vendors: governance meetings — start: 0, dur: 29

**Clinical Supplies (35 activities, sl-007):**
137. Develop package design — start: -5, dur: 2
138. Quotation Requests (packager, procurement) — start: -5, dur: 1
139. Vendor Selection for Packaging & Labeling — start: -4, dur: 2
140. Prepare/Finalize Label Specs all countries — start: -3, dur: 2
141. Label (English Master) Spec review — start: -3, dur: 1
142. Label Translations by CRO — start: -2, dur: 2
143. Jazz Final Label approval — start: -1, dur: 1
144. Generate Technical Memo — start: -4, dur: 1
145. Develop/Approve Vendor Documents — start: -3, dur: 3
146. Set up country depots — start: -1, dur: 2
147. Final Package and Label IMP — start: -2, dur: 3
148. Write/Review/Approve IRT Specification (Supplies) — start: -4, dur: 2
149. Program and build IRT — start: -2, dur: 2
150. Perform IRT UAT (Supplies) — start: -1, dur: 1
151. Dummy Kit List Approved — start: -3, dur: 1
152. Final Kit List approved — start: -2, dur: 1
153. Kit List sent to Vendor — start: -1, dur: 1
154. Comparator Drug Sourcing — start: -5, dur: 3
155. Finalize comparator sourcing strategy — start: -3, dur: 2
156. IMP Instructions for Use — start: -2, dur: 1
157. Ship IMP to Site — start: 1, dur: 1
158. Finished IMP Specifications — start: -3, dur: 2
159. Develop package specifications — start: -3, dur: 1
160. Manage expiry updates and resupplies — start: 2, dur: 21
161. Perform ongoing temperature excursion checks — start: 2, dur: 21
162. Oversee ongoing import/export/bulk release — start: 2, dur: 21
163. Drug Finished Package Testing Released — start: -1, dur: 1
164. Upload kits into IRT — start: -1, dur: 1
165. Released Available to Ship to Sites — start: 0, dur: 1
166. Ensure site supplies in place — start: 1, dur: 22
167. Clinical Trial drug supply to support study — start: 2, dur: 21
168. Clinical supply issue management & resolution — start: 2, dur: 21
169. Oversee IMP distribution/return/destruction — start: 2, dur: 21
170. Close out country depots — start: 24, dur: 2
171. Execute drug return/destruction plan — start: 24, dur: 3

**CMC (11 activities, sl-008):**
172. CMO Selection — start: -7, dur: 2
173. Tech Transfer & Scale Up — start: -6, dur: 3
174. Phase Appropriate Documentation — start: -5, dur: 3
175. Bulk Drug Manufacturing — start: -4, dur: 3
176. Batch Manufacture — start: -3, dur: 2
177. Batch Release — start: -2, dur: 1
178. QA Perform Bulk Drug Release — start: -1, dur: 1
179. Ship Bulk Drug to Packager — start: -1, dur: 1
180. Regulatory CMC Submissions (IND, IMPD) — start: -2, dur: 2
181. Finished IMP Specifications (CMC) — start: -3, dur: 2
182. QA/QP Release of Finished IMP — start: 0, dur: 1

**Clinical Data Operations (16 activities, sl-009):**
183. Create Data Collection Matrix — start: -4, dur: 2
184. eCOA specs, build, go live — start: -3, dur: 3
185. Create Specs and program EDC / integrations / UAT — start: -3, dur: 4
186. Develop CRF Completion Guidelines — start: -3, dur: 2
187. Write/Review/Approve IRT Specification (DataOps) — start: -4, dur: 2
188. Perform IRT UAT (DataOps) — start: -1, dur: 1
189. EDC go-live — start: 0, dur: 1
190. Develop Data Management Plan — start: -2, dur: 2
191. Develop Clinical Data Review Plan (CDRP) — start: -1, dur: 2
192. Program & QC data review listings in CDF (DataOps) — start: 0, dur: 2
193. Ongoing data cleaning — start: 2, dur: 23
194. Perform DBL activities — start: 24, dur: 2
195. Final Third Party Vendor Transfer — start: 24, dur: 1
196. All data queries & recon complete — start: 25, dur: 1
197. Produce all subject case books — start: 25, dur: 2
198. Blinded Data Review (DataOps) — start: 23, dur: 2

**Data Science (19 activities, sl-010):**
199. DMC/DSMB Charter development — start: -3, dur: 2
200. Prepare DMC final charter — start: -2, dur: 1
201. Develop & Approve Randomization Specs — start: -2, dur: 2
202. Approve Dummy Randomization List — start: -1, dur: 1
203. Dummy Kit List Approved (DataSci) — start: -2, dur: 1
204. First Stable Version of SAP — start: -3, dur: 2
205. Pre-final Stable SAP and Shells — start: -2, dur: 2
206. First Stable Version of TLF Shells — start: -3, dur: 2
207. Write/Review/Approve IRT Spec (DataSci) — start: -4, dur: 2
208. Perform IRT UAT (DataSci) — start: -1, dur: 1
209. CDF out-of-the-box analytics go-live (DataSci) — start: 1, dur: 1
210. First Dry Run — start: 3, dur: 2
211. Blinded Data Review (DataSci) — start: 23, dur: 2
212. Final SAP — start: 24, dur: 1
213. Review and interpret topline results — start: 25, dur: 1
214. Generate SDTM/ADAM/topline TFL — start: 25, dur: 2
215. Generate Final TFLs (submission ready) — start: 27, dur: 2
216. Final iCSR — start: 28, dur: 1
217. Collect PI Signatures (DataSci) — start: 27, dur: 2

**Safety (8 activities, sl-011):**
218. Set up Safety Management Plan — start: -3, dur: 2
219. Set up safety Database — start: -3, dur: 2
220. Perform IRT UAT (Safety) — start: -1, dur: 1
221. Finalize communication plan (pivotal study) — start: -1, dur: 1
222. Ongoing Safety Management incl SUSAR — start: 2, dur: 23
223. Ongoing SAE reconciliation — start: 2, dur: 23
224. Ensure TMF sections complete (Safety) — start: 23, dur: 3
225. All data queries & recon complete (Safety) — start: 25, dur: 1

**Project Management (3 activities, sl-012):**
226. Oversee Project Team Activities — start: -5, dur: 34
227. Oversee CRO/vendor governance meetings — start: 0, dur: 29
228. Portfolio KPIs, metrics — start: 0, dur: 29

**Quality (3 activities, sl-013):**
229. Quality Technical Agreement with Vendor — start: -4, dur: 2
230. QA Perform Bulk Drug Release (Quality) — start: -1, dur: 1
231. QA/QP Release of Finished IMP (Quality) — start: 0, dur: 1

> **Note**: Activity IDs run act-001 through act-231 (231 total after detailed breakdown). This is expected — the original 229 count was approximate; some activities appear in multiple swim lanes or were split during data entry.

#### Tags

```ts
tags: [
  { id: "tag-strategy", name: "strategy", color: "#818cf8" },
  { id: "tag-regulatory", name: "regulatory", color: "#f97316" },
  { id: "tag-vendor", name: "vendor-dependent", color: "#ef4444" },
  { id: "tag-critical", name: "critical-path", color: "#dc2626" },
  { id: "tag-ongoing", name: "ongoing", color: "#10b981" },
  { id: "tag-gate", name: "gate-dependent", color: "#8b5cf6" },
  { id: "tag-cro", name: "CRO-managed", color: "#ec4899" },
  { id: "tag-startup", name: "start-up", color: "#06b6d4" },
  { id: "tag-closeout", name: "close-out", color: "#78716c" },
]
```

#### Custom Field Definitions

```ts
customFieldDefinitions: [
  { key: "riskLevel", label: "Risk Level", type: "select", options: ["Low", "Medium", "High"] },
  { key: "regulatoryRegion", label: "Regulatory Region", type: "multiselect", options: ["US", "EU", "Japan", "ROW"] },
  { key: "vendorName", label: "Vendor Name", type: "text" },
  { key: "automatable", label: "Automatable", type: "boolean" },
]
```

### 2.2 Verification

Import `jazzPharmaTemplate` in `App.tsx` and render `template.activities.length` on screen. Should show 231 (or close). Confirm no TS errors.

---

## Step 3: Zustand Store with Undo/Redo

### 3.1 Create `src/store/undoMiddleware.ts`

Implement a temporal middleware for Zustand that tracks state history for undo/redo.

```ts
import { StateCreator, StoreApi } from 'zustand';

interface TemporalState<T> {
  past: T[];
  future: T[];
}

// The middleware should:
// 1. Snapshot the `template` portion of state before each action
// 2. Push it to `past` stack
// 3. Clear `future` stack on new actions
// 4. Provide `undo()` and `redo()` actions
// 5. Cap history at 100 entries to prevent memory bloat
```

### 3.2 Create `src/store/workflowStore.ts`

The central state store. Must implement ALL actions listed in the system design document's store interface.

Key implementation details:

- Use `immer` middleware for immutable state updates
- The store holds:
  - `template: WorkflowTemplate` — the full workflow data
  - `selectedActivityId: string | null`
  - `activeView: ViewMode`
  - `filters: FilterState`
  - `zoomLevel: number` (1=quarter, 2=month, 3=week)
  - `isDirty: boolean` — tracks unsaved changes
  - `collapsedLanes: Set<string>` — which swim lanes are collapsed
- `endMonth` must be recomputed whenever `startMonth` or `durationMonths` changes
- Export: serialize `template` as JSON with `ExportPayload` wrapper
- Import: validate with Zod schema, replace entire `template`

### 3.3 Create `src/utils/idGenerator.ts`

```ts
import { v4 as uuidv4 } from 'uuid';

export function generateActivityId(): string {
  return `act-${uuidv4().substring(0, 8)}`;
}
export function generateMilestoneId(): string {
  return `ms-${uuidv4().substring(0, 8)}`;
}
export function generateSwimLaneId(): string {
  return `sl-${uuidv4().substring(0, 8)}`;
}
```

### 3.4 Create `src/utils/timeUtils.ts`

```ts
export function monthToLabel(month: number): string {
  if (month < 0) return `${month} Mo`;
  if (month === 0) return 'IND';
  return `+${month} Mo`;
}

export function monthsToWeeks(months: number): number {
  return Math.round(months * 4.3);
}
```

### 3.5 Verification

Write a quick test in `App.tsx`:
1. Load the store
2. Verify `store.template.activities.length` matches expected count
3. Call `updateActivity(id, { durationMonths: 5 })`, verify it updates
4. Call `undo()`, verify it reverts
5. Call `redo()`, verify it re-applies

---

## Step 4: Utility Functions

### 4.1 Create `src/utils/criticalPath.ts`

Implement the Critical Path Method (CPM) algorithm:

```ts
interface CPMResult {
  criticalActivities: string[];  // IDs of activities on critical path
  projectDuration: number;       // Total months
  floats: Map<string, number>;   // Activity ID → total float
}

export function computeCriticalPath(
  activities: Activity[],
  milestones: Milestone[]
): CPMResult {
  // 1. Build adjacency list from dependencies
  // 2. Topological sort (Kahn's algorithm — also detects cycles)
  // 3. Forward pass: compute ES (earliest start) and EF (earliest finish)
  //    ES = max(EF of all predecessors + lag)
  //    EF = ES + duration
  // 4. Backward pass: compute LF (latest finish) and LS (latest start)
  //    LF = min(LS of all successors - lag)
  //    LS = LF - duration
  // 5. Float = LS - ES
  // 6. Critical path = activities where float === 0
}
```

Also export:
```ts
export function detectCircularDependencies(activities: Activity[]): string[][] {
  // Returns arrays of cycle paths (activity ID chains)
  // Uses DFS with coloring (white/gray/black)
}
```

### 4.2 Create `src/utils/validation.ts`

```ts
import { ExportPayloadSchema } from '../types/schema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateImport(jsonString: string): ValidationResult {
  // 1. Parse JSON
  // 2. Validate against Zod schema
  // 3. Check referential integrity:
  //    - All swimLaneId refs exist
  //    - All dependency predecessorId refs exist
  //    - All milestoneGateId refs exist
  // 4. Check temporal consistency:
  //    - endMonth === startMonth + durationMonths
  // 5. Check for circular dependencies
  // Return errors (blocking) and warnings (non-blocking)
}
```

### 4.3 Verification

Unit test the critical path algorithm with a small test graph (5 activities, known critical path). Verify `detectCircularDependencies` catches a simple cycle.

---

## Step 5: UI Primitives & Layout Shell

### 5.1 Create reusable UI components in `src/components/ui/`

Build these minimal, Tailwind-styled primitives:

- **Button.tsx** — variants: primary, secondary, ghost, danger. Sizes: sm, md.
- **Dropdown.tsx** — wrapper around a native `<select>` or a custom popover with search.
- **Modal.tsx** — overlay with backdrop, close button, trap focus.
- **Tooltip.tsx** — hover tooltip using CSS-only approach (or a tiny library).
- **Badge.tsx** — colored pill for tags, dependency types, etc.

### 5.2 Create `src/App.tsx` — main layout shell

```tsx
// Layout structure:
// ┌─────────────────────────────────────┐
// │            TopBar                    │
// ├─────────────────────────────────────┤
// │            FilterBar                 │
// ├────────────────────────┬────────────┤
// │                        │  Activity  │
// │   GanttView or         │  Detail    │
// │   TableView            │  Panel     │
// │                        │  (drawer)  │
// │                        │            │
// ├────────────────────────┴────────────┤
// │            StatusBar                 │
// └─────────────────────────────────────┘
```

Use flex layout. The detail panel slides in from the right when an activity is selected.

### 5.3 Create `src/components/layout/TopBar.tsx`

Contains:
- App title ("Clinical Trial Workflow Editor")
- Template name (editable)
- ViewToggle component (Gantt | Table buttons)
- Undo / Redo buttons with keyboard shortcut hints
- Zoom control (only visible in Gantt mode): - / level dropdown / +
- File menu: Import JSON, Export JSON, New Template

### 5.4 Create `src/components/layout/FilterBar.tsx`

Contains:
- Swim lane multi-select filter (checkboxes with color swatches)
- Tag multi-select filter
- Search input (filters activities by name, debounced)
- "Critical Path Only" toggle
- Activity count display

### 5.5 Create `src/components/layout/StatusBar.tsx`

Bottom bar showing:
- Total activity count (filtered/total)
- Critical path length in months
- Dirty indicator ("Unsaved changes" dot)
- Template version

### 5.6 Create `src/hooks/useKeyboardShortcuts.ts`

Register global keyboard shortcuts:
- `Ctrl+Z` — Undo
- `Ctrl+Shift+Z` or `Ctrl+Y` — Redo
- `Delete` or `Backspace` — Delete selected activity (with confirmation)
- `Ctrl+D` — Duplicate selected activity
- `Ctrl+S` — Export JSON (save)
- `Escape` — Deselect / close panel
- `1` — Switch to Gantt view
- `2` — Switch to Table view

### 5.7 Verification

Run `npm run dev`. The app should show the full layout shell with TopBar, FilterBar, an empty main content area, and StatusBar. Undo/Redo buttons and view toggle should be wired to the store. Keyboard shortcuts should work.

---

## Step 6: Table View

### 6.1 Create `src/components/table/TableView.tsx`

The main table container using TanStack Table:

- Columns: `#`, `Activity Name`, `Swim Lane`, `Start Month`, `Duration`, `End Month` (computed), `Dependencies`, `Critical Path` (badge), `Tags`, `Optional` (toggle), `Actions`
- Features:
  - Column sorting (click header)
  - Column resizing
  - Virtual scrolling for 231+ rows (use `@tanstack/react-virtual`)
  - Grouping by swim lane (optional toggle — group headers with lane color)
  - Sticky header row
  - Selected row highlight (blue outline)
  - Click row → sets `selectedActivityId` in store

### 6.2 Create `src/components/table/EditableCell.tsx`

Inline editing for text and number cells:
- Click cell → switch to input mode
- Enter or blur → commit edit to store
- Escape → cancel edit
- For number cells: validate input is numeric
- For text cells: minimum 1 character

### 6.3 Create `src/components/table/DependencyChips.tsx`

Display dependencies as colored chips showing predecessor name + type:
- e.g. `[Protocol Dev] FS` with blue chip for FS
- Click chip → opens DependencyEditor modal
- Small × button to remove dependency

### 6.4 Create `src/components/table/TagChips.tsx`

Display tags as colored pills:
- Click to open tag picker (dropdown with checkboxes)
- × to remove

### 6.5 Add row actions

Each row gets a `...` menu or inline buttons:
- **Edit** — opens ActivityDetailPanel
- **Duplicate** — copies activity with new ID, name + " (copy)"
- **Delete** — with ConfirmDialog

### 6.6 Add "Add Activity" button

Below the table:
- Creates a new activity with defaults (current view's first visible swim lane, startMonth 0, duration 1)
- Immediately opens it in edit mode in the detail panel

### 6.7 Verification

- Load the app, switch to Table view
- All 231 activities render in the table
- Click a cell, edit inline, confirm the store updates
- Sort by swim lane, then by start month
- Add a new activity, delete it
- Verify the StatusBar updates activity count

---

## Step 7: Activity Detail Panel

### 7.1 Create `src/components/shared/ActivityDetailPanel.tsx`

A slide-out drawer (from the right, ~400px wide) that shows when `selectedActivityId` is set.

Sections:
1. **Header**: Activity name (large, editable), close button (×)
2. **Timing**: Start Month (number input), Duration (number input with up/down), End Month (read-only computed). Visual mini-bar showing relative position.
3. **Assignment**: Swim Lane dropdown, Owner text input
4. **Flags**: Critical Path toggle, Optional toggle, Continuous toggle
5. **Milestone Gate**: Dropdown of milestones (or "None")
6. **Dependencies**: List of current dependencies with type badges. "Add Dependency" button opens DependencyEditor.
7. **Tags**: Tag multi-select with color pills
8. **Inputs / Outputs**: Editable string arrays (add/remove items)
9. **Description**: Multi-line textarea
10. **Notes**: Multi-line textarea
11. **Custom Fields**: Render based on `customFieldDefinitions` — text inputs, selects, toggles as appropriate

All changes save immediately to the store (no explicit save button — changes are live).

### 7.2 Create `src/components/shared/DependencyEditor.tsx`

A modal for adding/editing dependencies:
- Searchable dropdown of all activities + milestones (excluding self and already-linked)
- Dependency type selector: FS / SS / FF / SF (radio buttons with descriptions)
- Lag input (number, default 0)
- "Add" button
- Existing dependencies listed with edit/remove options

### 7.3 Verification

- Click an activity in the table
- Detail panel slides in
- Edit every field, confirm store updates
- Add a dependency, remove it
- Close panel with × or Escape

---

## Step 8: Gantt View

This is the most complex component. Build incrementally.

### 8.1 Create `src/components/gantt/GanttView.tsx`

Main container:
- Layout: fixed left column (swim lane labels, ~200px) + scrollable right area (timeline)
- Vertical: rows grouped by swim lane, each swim lane has a header row and activity rows
- Uses `@tanstack/react-virtual` for virtualized row rendering

### 8.2 Create `src/components/gantt/TimelineHeader.tsx`

The horizontal time axis:
- Renders month columns from `timeConfig.rangeStart` to `timeConfig.rangeEnd`
- Column width depends on zoom level:
  - Quarter view: 40px per month
  - Month view: 80px per month (default)
  - Week view: 160px per month
- Month labels at top: `-7`, `-6`, ... `0`, `+1`, ... `+29`
- Vertical grid lines at each month boundary (light gray, dashed)
- Milestone diamonds rendered in the header row at their month positions

### 8.3 Create `src/components/gantt/SwimLaneGroup.tsx`

A collapsible group:
- Header row: colored bar with lane name, activity count badge, collapse toggle (▾/▸)
- When expanded: renders `ActivityBar` for each activity in the lane
- When collapsed: shows just the header (single row height)
- Activities sorted by `startMonth` within each lane

### 8.4 Create `src/components/gantt/ActivityBar.tsx`

The core interactive element:
- Horizontal bar positioned at `(startMonth - rangeStart) * columnWidth` from the left
- Width = `durationMonths * columnWidth`
- Height: ~28px with 4px gap between rows
- Background color: swim lane color with 80% opacity
- Border: 2px solid swim lane color. If critical path: red border + subtle glow.
- Text: activity name, truncated with ellipsis if too long
- Tooltip on hover: full name, start month, duration, end month
- Click: selects the activity (sets `selectedActivityId`)
- **Drag right edge**: resize duration (use @dnd-kit or pointer events)
  - On drag: show ghost preview of new duration
  - On drop: update `durationMonths` in store
  - Snap to nearest 0.5 month increments
- **Drag center**: move start date
  - On drag: show ghost preview of new position
  - On drop: update `startMonth` in store
  - Snap to nearest 0.5 month increments
- Continuous activities: use a dashed border and extend to rangeEnd

### 8.5 Create `src/components/gantt/MilestoneMarker.tsx`

Diamond-shaped marker:
- Positioned at the milestone's month on the timeline
- Size: ~16px diamond (rotated square)
- Color: milestone swim lane color
- Tooltip: milestone name and gate type
- Click: show milestone details (could reuse detail panel or a popover)

### 8.6 Create `src/components/gantt/DependencyArrows.tsx`

SVG overlay rendered on top of the Gantt chart:
- Only shown when "Show Dependencies" is toggled on, OR for the selected activity
- For each dependency:
  - Draw a path from the predecessor's right edge (FS) or left edge (SF/SS) to the successor's left edge (FS/SS) or right edge (FF/SF)
  - Use SVG `<path>` with cubic bezier curves for smooth routing
  - Arrowhead at the destination end
  - Color-coded by type: FS=#3b82f6, SS=#10b981, FF=#8b5cf6, SF=#f97316
  - On hover: show tooltip with dependency details
  - On click (when selected): press Delete to remove

### 8.7 Create `src/components/gantt/CriticalPathOverlay.tsx`

When "Critical Path" filter is active:
- All non-critical activities fade to 30% opacity
- Critical path activities get a red left border or glow effect
- Critical path dependency arrows highlighted in red

### 8.8 Implement drag interaction for adding dependencies

When user holds Shift and drags from one activity bar to another:
- Show a temporary arrow following the cursor
- On drop on target activity: open DependencyEditor modal pre-filled with source and target

### 8.9 Verification

- Switch to Gantt view
- All swim lanes render with correct colors
- Activities appear as bars at correct positions
- Drag right edge of a bar → duration changes
- Drag center of a bar → start date changes
- Click a bar → detail panel opens
- Collapse/expand swim lanes
- Zoom in/out changes column width
- Milestone diamonds visible in header

---

## Step 9: JSON Import / Export

### 9.1 Create `src/components/shared/JsonImportExport.tsx`

**Export button:**
- Serializes current `template` state into an `ExportPayload`
- Uses `JSON.stringify(payload, null, 2)` for readable output
- Triggers download via `URL.createObjectURL` + hidden `<a>` click
- Filename: `{client}_{template-name}_v{version}_{YYYYMMDD}.json`
  - Sanitize: lowercase, replace spaces with hyphens
- Sets `isDirty = false` after export

**Import button:**
- Opens native file picker (accept=`.json`)
- Reads file via `FileReader`
- Calls `validateImport()` from `src/utils/validation.ts`
- If valid: replaces `template` in store, resets undo history
- If invalid: shows error modal listing all validation errors
- Confirm dialog if current state is dirty: "You have unsaved changes. Import will replace all data."

**Drag-and-drop import:**
- The entire app should accept drag-and-drop of `.json` files
- Show a blue overlay "Drop JSON file to import" when dragging over

### 9.2 Verification

- Export the template → open the .json file, verify structure
- Edit a few activities, export again → verify changes persisted
- Import a valid file → verify it loads
- Import an invalid file (manually corrupt the JSON) → verify error display
- Test drag-and-drop import

---

## Step 10: Polish & Integration Testing

### 10.1 Keyboard shortcuts

Verify all shortcuts from Step 5.6 work across both views.

### 10.2 Cross-view consistency

- Edit an activity in Table view → switch to Gantt → verify bar updated
- Drag a bar in Gantt → switch to Table → verify cell updated
- Filter by swim lane → both views only show matching activities

### 10.3 Undo/Redo

Test these scenarios work with undo/redo:
- Change duration (Gantt drag)
- Change start month (Gantt drag)
- Inline edit in table
- Add activity
- Delete activity
- Add/remove dependency
- Change swim lane assignment

### 10.4 Edge cases

- Activity with 0 duration (milestone-like) — renders as thin line
- Continuous activity — extends to end of timeline
- Activity at extreme ends of timeline
- Very long activity name — truncated properly
- Many dependencies on one activity — arrows don't overlap terribly
- Empty template (all activities deleted) — shows empty state message

### 10.5 Performance

- With 231 activities, both views should render at 60fps
- Scrolling the Gantt should be smooth (virtual scrolling)
- Drag operations should feel responsive

### 10.6 Responsive layout

- Test at 1280px viewport — everything visible, no horizontal overflow on the app shell (Gantt timeline scrolls independently)
- Test at 1920px — Gantt uses the extra width

### 10.7 Final export test

- Load the default Jazz Pharma template
- Make 10+ edits across both views
- Export the JSON
- Refresh the page (back to default template)
- Import the JSON
- Verify all edits are preserved

---

## File-by-File Build Order Summary

For maximum efficiency, build files in this order (each step builds on the previous):

| Order | Files | Depends On |
|-------|-------|-----------|
| 1 | `types/index.ts`, `types/schema.ts` | Nothing |
| 2 | `utils/idGenerator.ts`, `utils/timeUtils.ts` | Types |
| 3 | `data/jazzPharmaTemplate.ts` | Types, Utils |
| 4 | `store/undoMiddleware.ts` | Types |
| 5 | `store/workflowStore.ts` | Types, Template, Undo |
| 6 | `utils/criticalPath.ts`, `utils/validation.ts` | Types |
| 7 | `components/ui/*` | Tailwind |
| 8 | `hooks/*` | Store |
| 9 | `App.tsx` (layout shell) | UI components |
| 10 | `components/layout/*` | Store, UI |
| 11 | `components/shared/ActivityDetailPanel.tsx` | Store, UI |
| 12 | `components/shared/DependencyEditor.tsx` | Store, UI |
| 13 | `components/shared/JsonImportExport.tsx` | Store, Validation |
| 14 | `components/table/*` | Store, UI, Shared |
| 15 | `components/gantt/TimelineHeader.tsx` | Store |
| 16 | `components/gantt/SwimLaneGroup.tsx` | Store, ActivityBar |
| 17 | `components/gantt/ActivityBar.tsx` | Store, dnd-kit |
| 18 | `components/gantt/MilestoneMarker.tsx` | Store |
| 19 | `components/gantt/DependencyArrows.tsx` | Store |
| 20 | `components/gantt/CriticalPathOverlay.tsx` | CriticalPath util |
| 21 | `components/gantt/GanttView.tsx` | All Gantt sub-components |
| 22 | Integration testing & polish | Everything |

---

## Key Architectural Reminders

1. **JSON is the system of record.** Every state change modifies the `WorkflowTemplate` in the store. The template is always exportable as valid JSON.

2. **`endMonth` is always computed.** Never store it independently — always derive as `startMonth + durationMonths`. The Zod schema validates this on import.

3. **IDs are stable strings.** Pre-loaded template uses `act-001` format. New items use `act-{uuid8}` format. Never use array indices as IDs.

4. **Undo captures the entire `template` object.** This is simpler than tracking individual diffs and works well for <300 activities. Cap at 100 undo steps.

5. **Filters are view-level state, not template state.** Filters, zoom, collapsed lanes, and selected activity are NOT exported in the JSON. They are transient UI state.

6. **Dependencies reference IDs, not indices.** A dependency's `predecessorId` can be either an activity ID or a milestone ID. The system must handle both.

7. **The Gantt view uses DOM, not Canvas.** This enables native accessibility, tooltips, and click handlers without a custom hit-testing layer. Virtual scrolling handles performance.
