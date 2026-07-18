"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  canTransition,
  initialProject,
  initialTickets,
  initialWorkflowRuns,
  type ProjectConfig,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type WorkflowRun,
  validateReadyForAgent,
} from "./mergestamp-domain";

const demoWorkerUrl = "http://127.0.0.1:4317";

export type DemoHealth = {
  status: "ready" | "blocked";
  model: string;
  provider?: string;
  repository: string;
  checks: { name: string; ok: boolean; detail: string }[];
};

export type DemoServerRun = WorkflowRun & {
  status: "queued" | "running" | "succeeded" | "failed";
  model: string;
  error?: string;
  worktreePath?: string;
  ticket?: Pick<
    Ticket,
    "id" | "sequenceNumber" | "title" | "description" | "acceptanceCriteria"
  >;
};

export type TicketDraft = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: TicketPriority;
  type: TicketType;
  labels: string;
};

const emptyTicket: TicketDraft = {
  title: "",
  description: "",
  acceptanceCriteria: "",
  priority: "MEDIUM",
  type: "FEATURE",
  labels: "",
};

type MergeStampContextValue = {
  project: ProjectConfig;
  setProject: Dispatch<SetStateAction<ProjectConfig>>;
  tickets: Ticket[];
  workflowRuns: Record<string, WorkflowRun>;
  activeTicketId: string | null;
  setActiveTicketId: Dispatch<SetStateAction<string | null>>;
  activeTicket?: Ticket;
  activeRun?: WorkflowRun;
  validationMessages: string[];
  clearValidationMessages: () => void;
  ticketDraft: TicketDraft;
  setTicketDraft: Dispatch<SetStateAction<TicketDraft>>;
  intakePrompt: string;
  setIntakePrompt: Dispatch<SetStateAction<string>>;
  demoHealth: DemoHealth | null;
  workerMessage: string;
  demoRunning: boolean;
  prActionBusy: boolean;
  revisionBusy: boolean;
  refreshDemoHealth: () => Promise<void>;
  generateProjectDraft: () => void;
  updateRequirement: (
    key: keyof ProjectConfig["requirements"],
    value: string,
  ) => void;
  updateCommand: (key: keyof ProjectConfig["commands"], value: string) => void;
  addTicket: () => boolean;
  moveTicket: (ticketId: string, status: TicketStatus) => void;
  startWorkflow: (ticket: Ticket) => Promise<void>;
  runPullRequestAction: (
    runId: string,
    action: "ready" | "sync",
  ) => Promise<void>;
  addComment: (ticketId: string, comment: string) => void;
  requestRevision: (ticketId: string, feedback: string) => Promise<boolean>;
};

const MergeStampContext = createContext<MergeStampContextValue | null>(null);

function ticketFromRun(run: DemoServerRun, status: TicketStatus): Ticket | null {
  if (!run.ticket) return null;
  return {
    ...run.ticket,
    status,
    priority: "MEDIUM",
    type: "FEATURE",
    labels: [],
    expectedTests: "Run-scoped node:test suite",
    manualVerification: "Review the generated pull request.",
    relatedFiles: run.evidence.changedFiles,
    comments: [],
    workflowRunId: run.id,
    pullRequestUrl: run.pullRequestUrl,
    branchName: run.branchName,
    latestCommitSha: run.latestCommitSha,
    version: Math.max(run.events.length + 1, 1),
  };
}

export function MergeStampProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectConfig>(initialProject);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [workflowRuns, setWorkflowRuns] =
    useState<Record<string, WorkflowRun>>(initialWorkflowRuns);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [ticketDraft, setTicketDraft] = useState<TicketDraft>(emptyTicket);
  const [intakePrompt, setIntakePrompt] = useState(
    "Build MergeStamp in kanbanPilot with a focused board and governed ticket-to-PR workflows.",
  );
  const [demoHealth, setDemoHealth] = useState<DemoHealth | null>(null);
  const [demoRunId, setDemoRunId] = useState<string | null>(null);
  const [workerMessage, setWorkerMessage] = useState("Checking worker...");
  const [prActionBusy, setPrActionBusy] = useState(false);
  const [revisionBusy, setRevisionBusy] = useState(false);

  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId);
  const activeRun = activeTicket?.workflowRunId
    ? workflowRuns[activeTicket.workflowRunId]
    : undefined;
  const currentRun = demoRunId
    ? (workflowRuns[demoRunId] as DemoServerRun | undefined)
    : undefined;
  const demoRunning =
    currentRun?.status === "queued" || currentRun?.status === "running";

  const applyServerRun = useCallback((run: DemoServerRun) => {
    const nextStatus: TicketStatus =
      run.pullRequestState === "MERGED"
        ? "DONE"
        : run.status === "queued"
          ? run.revisionCount > 0
            ? "REVISION_QUEUED"
            : "READY_FOR_AGENT"
        : run.status === "succeeded"
          ? "READY_FOR_REVIEW"
          : "IN_PROGRESS";

    setWorkflowRuns((current) => ({ ...current, [run.id]: run }));
    setTickets((current) => {
      const existing = current.find((ticket) => ticket.id === run.ticketId);
      if (!existing) {
        const recovered = ticketFromRun(run, nextStatus);
        return recovered ? [recovered, ...current] : current;
      }
      return current.map((ticket) =>
        ticket.id === run.ticketId
          ? {
              ...ticket,
              status: nextStatus,
              workflowRunId: run.id,
              pullRequestUrl: run.pullRequestUrl,
              branchName: run.branchName,
              latestCommitSha: run.latestCommitSha,
              relatedFiles: run.evidence.changedFiles,
              version: Math.max(ticket.version, run.events.length + 1),
            }
          : ticket,
      );
    });
    if (run.status === "failed") {
      setValidationMessages([run.error || "The workflow failed."]);
    }
    if (run.status === "succeeded" || run.status === "failed") {
      setDemoRunId((current) => (current === run.id ? null : current));
    }
  }, []);

  const refreshDemoHealth = useCallback(async () => {
    try {
      const response = await fetch(`${demoWorkerUrl}/health`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Worker returned ${response.status}.`);
      const health = (await response.json()) as DemoHealth;
      setDemoHealth(health);
      setWorkerMessage(
        health.status === "ready" ? "Worker ready" : "Setup required",
      );
    } catch {
      setDemoHealth(null);
      setWorkerMessage("Worker offline");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${demoWorkerUrl}/health`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Worker returned ${response.status}.`);
        return response.json() as Promise<DemoHealth>;
      })
      .then((health) => {
        if (cancelled) return;
        setDemoHealth(health);
        setWorkerMessage(
          health.status === "ready" ? "Worker ready" : "Setup required",
        );
      })
      .catch(() => {
        if (cancelled) return;
        setDemoHealth(null);
        setWorkerMessage("Worker offline");
      });

    void fetch(`${demoWorkerUrl}/runs/current`, { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((run: DemoServerRun | null) => {
        if (!cancelled && run) {
          setDemoRunId(run.id);
          applyServerRun(run);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [applyServerRun]);

  useEffect(() => {
    if (!demoRunId) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`${demoWorkerUrl}/runs/${demoRunId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const run = (await response.json()) as DemoServerRun;
        if (!cancelled) applyServerRun(run);
      } catch {
        if (!cancelled) setWorkerMessage("Worker connection lost");
      }
    }

    void poll();
    const interval = window.setInterval(poll, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyServerRun, demoRunId]);

  function updateRequirement(
    key: keyof ProjectConfig["requirements"],
    value: string,
  ) {
    setProject((current) => ({
      ...current,
      requirements: { ...current.requirements, [key]: value },
    }));
  }

  function updateCommand(key: keyof ProjectConfig["commands"], value: string) {
    setProject((current) => ({
      ...current,
      commands: { ...current.commands, [key]: value },
      agentPolicy: {
        ...current.agentPolicy,
        allowedCommands: Array.from(
          new Set([...current.agentPolicy.allowedCommands, value].filter(Boolean)),
        ),
      },
    }));
  }

  function generateProjectDraft() {
    setProject((current) => ({
      ...current,
      productOverview: intakePrompt,
      goals: [
        "Govern the ticket-to-pull-request workflow from a focused board",
        "Keep project requirements explicit and reviewable",
        "Collect validation evidence before human review",
      ],
      intakeTranscript: [
        ...current.intakeTranscript,
        `User: ${intakePrompt}`,
        "Assistant: Updated the project configuration and workflow defaults.",
      ],
    }));
  }

  function addTicket() {
    const title = ticketDraft.title.trim();
    const description = ticketDraft.description.trim();
    if (!title || !description) {
      setValidationMessages(["Todo title and description are required."]);
      return false;
    }
    const criteria = ticketDraft.acceptanceCriteria
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const nextNumber =
      Math.max(...tickets.map((ticket) => ticket.sequenceNumber), 0) + 1;
    const ticket: Ticket = {
      id: `ticket-${Date.now()}`,
      sequenceNumber: nextNumber,
      title,
      description,
      acceptanceCriteria: criteria.length > 0 ? criteria : [description],
      status: "TODO",
      priority: ticketDraft.priority,
      type: ticketDraft.type,
      labels: ticketDraft.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      expectedTests: "Add tests that prove the acceptance criteria.",
      manualVerification: "Review the generated PR evidence package.",
      relatedFiles: [],
      comments: [],
      version: 1,
    };
    setTickets((current) => [ticket, ...current]);
    setActiveTicketId(ticket.id);
    setTicketDraft(emptyTicket);
    setValidationMessages([]);
    return true;
  }

  async function startWorkflow(ticket: Ticket) {
    const errors = validateReadyForAgent(ticket, project);
    if (errors.length > 0) {
      setValidationMessages(errors);
      return;
    }
    setActiveTicketId(ticket.id);
    setValidationMessages([]);
    setWorkerMessage("Starting workflow...");
    try {
      const response = await fetch(`${demoWorkerUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: {
            id: ticket.id,
            sequenceNumber: ticket.sequenceNumber,
            title: ticket.title,
            description: ticket.description,
            acceptanceCriteria: ticket.acceptanceCriteria,
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const failedChecks = body.preflight?.checks
          ?.filter((check: DemoHealth["checks"][number]) => !check.ok)
          .map(
            (check: DemoHealth["checks"][number]) =>
              `${check.name}: ${check.detail}`,
          );
        throw new Error(
          failedChecks?.join(" ") || body.error || "Unable to start workflow.",
        );
      }
      const run = body as DemoServerRun;
      setDemoRunId(run.id);
      applyServerRun(run);
      setWorkerMessage("Workflow running");
    } catch (error) {
      setWorkerMessage("Unable to start");
      setValidationMessages([
        error instanceof Error ? error.message : "Unable to start workflow.",
      ]);
      void refreshDemoHealth();
    }
  }

  function moveTicket(ticketId: string, status: TicketStatus) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.status === status) return;
    if (!canTransition(ticket.status, status)) {
      setValidationMessages(["That workflow transition is not available."]);
      return;
    }
    if (status === "READY_FOR_AGENT") {
      void startWorkflow(ticket);
      return;
    }
    setValidationMessages([
      "Workflow state is controlled by the worker and GitHub pull request.",
    ]);
  }

  async function runPullRequestAction(
    runId: string,
    action: "ready" | "sync",
  ) {
    setPrActionBusy(true);
    try {
      const response = await fetch(
        `${demoWorkerUrl}/runs/${runId}/actions/${action}`,
        { method: "POST" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "GitHub action failed.");
      applyServerRun(body as DemoServerRun);
    } catch (error) {
      setValidationMessages([
        error instanceof Error ? error.message : "GitHub action failed.",
      ]);
    } finally {
      setPrActionBusy(false);
    }
  }

  function addComment(ticketId: string, comment: string) {
    if (!comment.trim()) return;
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              comments: [...ticket.comments, comment.trim()],
              version: ticket.version + 1,
            }
          : ticket,
      ),
    );
  }

  async function requestRevision(ticketId: string, feedback: string) {
    const message = feedback.trim();
    const ticket = tickets.find((item) => item.id === ticketId);
    const run = ticket?.workflowRunId
      ? workflowRuns[ticket.workflowRunId]
      : undefined;

    if (!message) {
      setValidationMessages(["Describe what should change before requesting a revision."]);
      return false;
    }
    const failedRevision =
      ticket?.status === "IN_PROGRESS" &&
      run?.state === "FAILED" &&
      run.revisionCount > 0;
    const alreadyQueued = ticket?.status === "REVISION_QUEUED" || failedRevision;
    if (
      !ticket ||
      !run ||
      (!alreadyQueued && !canTransition(ticket.status, "REVISION_QUEUED"))
    ) {
      setValidationMessages(["A revision can only be requested while a ticket is in review."]);
      return false;
    }
    if (!run.pullRequestUrl || run.pullRequestState === "MERGED" || run.pullRequestState === "CLOSED") {
      setValidationMessages(["The pull request must be open before requesting a revision."]);
      return false;
    }
    if (!alreadyQueued && run.revisionCount >= project.agentPolicy.maxRevisionCycles) {
      setValidationMessages([
        `This ticket has reached the ${project.agentPolicy.maxRevisionCycles}-revision limit.`,
      ]);
      return false;
    }

    setRevisionBusy(true);
    setValidationMessages([]);
    setWorkerMessage(alreadyQueued ? "Resuming revision..." : "Queueing revision...");
    try {
      const response = await fetch(`${demoWorkerUrl}/runs/${run.id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: message,
          alreadyQueued,
          revisionCount: run.revisionCount,
          run,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to queue the revision.");
      const serverRun = body as DemoServerRun;
      setDemoRunId(serverRun.id);
      applyServerRun(serverRun);
      if (!alreadyQueued) {
        const revisionNote = `Revision ${serverRun.revisionCount}: ${message}`;
        setTickets((current) =>
          current.map((item) =>
            item.id === ticketId
              ? {
                  ...item,
                  comments: [...item.comments, revisionNote],
                  version: item.version + 1,
                }
              : item,
          ),
        );
      }
      setWorkerMessage("Revision queued");
      return true;
    } catch (error) {
      setWorkerMessage("Unable to start revision");
      setValidationMessages([
        error instanceof Error ? error.message : "Unable to queue the revision.",
      ]);
      void refreshDemoHealth();
      return false;
    } finally {
      setRevisionBusy(false);
    }
  }

  const value: MergeStampContextValue = {
    project,
    setProject,
    tickets,
    workflowRuns,
    activeTicketId,
    setActiveTicketId,
    activeTicket,
    activeRun,
    validationMessages,
    clearValidationMessages: () => setValidationMessages([]),
    ticketDraft,
    setTicketDraft,
    intakePrompt,
    setIntakePrompt,
    demoHealth,
    workerMessage,
    demoRunning,
    prActionBusy,
    revisionBusy,
    refreshDemoHealth,
    generateProjectDraft,
    updateRequirement,
    updateCommand,
    addTicket,
    moveTicket,
    startWorkflow,
    runPullRequestAction,
    addComment,
    requestRevision,
  };

  return (
    <MergeStampContext.Provider value={value}>
      {children}
    </MergeStampContext.Provider>
  );
}

export function useMergeStamp() {
  const context = useContext(MergeStampContext);
  if (!context) {
    throw new Error("useMergeStamp must be used within MergeStampProvider.");
  }
  return context;
}
