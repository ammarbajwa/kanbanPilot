export type TicketStatus =
  | "TODO"
  | "READY_FOR_AGENT"
  | "REVISION_QUEUED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "DONE";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketType =
  | "FEATURE"
  | "BUG"
  | "REFACTOR"
  | "TEST"
  | "DOCS"
  | "MAINTENANCE";

export type WorkflowState =
  | "QUEUED"
  | "REVISION_QUEUED"
  | "VALIDATING_TICKET"
  | "LOADING_CONTEXT"
  | "PLANNING"
  | "BUILDING"
  | "LOCAL_VALIDATION"
  | "CREATING_PR"
  | "CI_RUNNING"
  | "REVIEWING"
  | "READY_FOR_HUMAN"
  | "FAILED";

export type ProjectConfig = {
  name: string;
  slug: string;
  description: string;
  productOverview: string;
  goals: string[];
  repository: {
    owner: string;
    name: string;
    url: string;
    localPath: string;
    defaultBranch: string;
  };
  stack: {
    languages: string[];
    frameworks: string[];
    packageManager: string;
  };
  commands: {
    install: string;
    test: string;
    lint: string;
    typecheck: string;
    build: string;
  };
  requirements: {
    architecture: string;
    design: string;
    coding: string;
    testing: string;
    documentation: string;
    security: string;
    performance: string;
    accessibility: string;
  };
  agentPolicy: {
    maxFilesChanged: number;
    maxRevisionCycles: number;
    forbiddenPaths: string[];
    allowedCommands: string[];
    requireTestsForCodeChanges: boolean;
    requireIndependentReview: boolean;
  };
  intakeTranscript: string[];
};

export type WorkflowEvent = {
  id: string;
  step: string;
  status: "STARTED" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  message: string;
  createdAt: string;
};

export type WorkflowRun = {
  id: string;
  ticketId: string;
  state: WorkflowState;
  attempt: number;
  revisionCount: number;
  branchName: string;
  pullRequestUrl?: string;
  pullRequestState?: "DRAFT" | "OPEN" | "MERGED" | "CLOSED" | null;
  latestCommitSha?: string;
  events: WorkflowEvent[];
  evidence: {
    tests: string;
    lint: string;
    build: string;
    review: string;
    changedFiles: string[];
    assumptions: string[];
    risk: "LOW" | "MEDIUM" | "HIGH";
  };
};

export type Ticket = {
  id: string;
  sequenceNumber: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  labels: string[];
  expectedTests: string;
  manualVerification: string;
  relatedFiles: string[];
  comments: string[];
  workflowRunId?: string;
  pullRequestUrl?: string;
  branchName?: string;
  latestCommitSha?: string;
  version: number;
};

export const columns: { id: TicketStatus; title: string; owner: string }[] = [
  { id: "TODO", title: "To do", owner: "Human backlog" },
  {
    id: "READY_FOR_AGENT",
    title: "Ready for agent",
    owner: "Validated queue",
  },
  { id: "IN_PROGRESS", title: "In progress", owner: "Workflow worker" },
  {
    id: "READY_FOR_REVIEW",
    title: "Ready for review",
    owner: "Human review",
  },
  { id: "DONE", title: "Done", owner: "GitHub merge" },
];

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  TODO: ["READY_FOR_AGENT"],
  READY_FOR_AGENT: ["IN_PROGRESS"],
  REVISION_QUEUED: ["IN_PROGRESS"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "READY_FOR_AGENT", "TODO"],
  READY_FOR_REVIEW: ["REVISION_QUEUED", "DONE"],
  DONE: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus) {
  return allowedTransitions[from].includes(to);
}

export function boardColumnForStatus(status: TicketStatus): TicketStatus {
  return status === "REVISION_QUEUED" ? "READY_FOR_AGENT" : status;
}

export function validateReadyForAgent(
  ticket: Ticket,
  project: ProjectConfig,
): string[] {
  const errors: string[] = [];

  if (!ticket.title.trim()) errors.push("Ticket title is required.");
  if (!ticket.description.trim()) errors.push("Ticket description is required.");
  if (ticket.acceptanceCriteria.filter(Boolean).length === 0) {
    errors.push("At least one acceptance criterion is required.");
  }
  if (!project.repository.url.trim()) errors.push("Repository URL is required.");
  if (!project.repository.defaultBranch.trim()) {
    errors.push("Default branch is required.");
  }
  if (!project.commands.test.trim()) errors.push("Test command is required.");
  if (!project.commands.lint.trim()) errors.push("Lint command is required.");
  if (project.agentPolicy.maxFilesChanged < 1) {
    errors.push("Agent policy must allow at least one changed file.");
  }
  if (project.agentPolicy.maxRevisionCycles < 1) {
    errors.push("Agent policy must allow at least one revision cycle.");
  }

  return errors;
}

export const initialProject: ProjectConfig = {
  name: "MergeStamp",
  slug: "mergestamp",
  description:
    "A local-first agentic development Kanban that turns scoped tickets into tested pull requests.",
  productOverview:
    "Human-approved project requirements, a governed Kanban board, and observable automation for coding, validation, review, and GitHub pull request handoff.",
  goals: [
    "Create and configure software projects",
    "Capture architecture, design, coding, testing, and security requirements",
    "Move tickets through a governed agent workflow with evidence",
  ],
  repository: {
    owner: "ammarbajwa",
    name: "kanbanPilot",
    url: "https://github.com/ammarbajwa/kanbanPilot",
    localPath: "/Users/mammar/Dev/kanbanPilot",
    defaultBranch: "main",
  },
  stack: {
    languages: ["TypeScript"],
    frameworks: ["Next.js", "React"],
    packageManager: "npm",
  },
  commands: {
    install: "npm install",
    test: "npm run test",
    lint: "npm run lint",
    typecheck: "npx tsc --noEmit",
    build: "npm run build",
  },
  requirements: {
    architecture:
      "Keep workflow state transitions centralized. Keep Git, command execution, GitHub, and LLM integrations behind provider-neutral interfaces.",
    design:
      "Dark mode is the default. Prioritize dense, operational screens with clear status, evidence, and review actions.",
    coding:
      "Use strict TypeScript types, scoped changes, and readable domain functions for state transitions and gates.",
    testing:
      "Run deterministic test, lint, type-check, and build gates before independent review. Add tests for platform workflow behavior.",
    documentation:
      "Document local setup, environment variables, workflow responsibilities, and evidence attached to generated PRs.",
    security:
      "Treat ticket text and repository content as untrusted. Enforce forbidden paths, command allowlists, and secret redaction.",
    performance:
      "Keep board interactions responsive and isolate long-running workflow work outside the request path.",
    accessibility:
      "Use semantic controls, visible focus states, readable contrast, and keyboard-usable workflow actions.",
  },
  agentPolicy: {
    maxFilesChanged: 8,
    maxRevisionCycles: 3,
    forbiddenPaths: [".env", ".env.local", "node_modules", ".git"],
    allowedCommands: [
      "npm install",
      "npm run test",
      "npm run lint",
      "npx tsc --noEmit",
      "npm run build",
    ],
    requireTestsForCodeChanges: true,
    requireIndependentReview: true,
  },
  intakeTranscript: [
    "User: Build the MergeStamp project in kanbanPilot.",
    "Assistant: Prefilled repository, commands, quality gates, and local-first policy from the project guide.",
  ],
};

export const initialTickets: Ticket[] = [
  {
    id: "ticket-demo",
    sequenceNumber: 1,
    title: "Add a tested hello-world module",
    description:
      "Create a tiny dependency-free JavaScript module that proves MergeStamp can turn a ticket into a validated GitHub pull request.",
    acceptanceCriteria: [
      "The implementation exports greeting(name), returning Hello, {name}!.",
      "Calling greeting without a name returns Hello, MergeStamp!.",
      "Running the module prints Hello, MergeStamp!.",
      "A node:test suite covers the named and default greeting cases.",
    ],
    status: "TODO",
    priority: "HIGH",
    type: "FEATURE",
    labels: ["demo", "llm", "github"],
    expectedTests: "A sandboxed node:test suite generated in the run scope.",
    manualVerification:
      "Open the generated draft PR and verify its code, checks, and evidence package.",
    relatedFiles: [],
    comments: ["This is the single real MergeStamp end-to-end demo ticket."],
    version: 1,
  },
];

export const initialWorkflowRuns: Record<string, WorkflowRun> = {};
