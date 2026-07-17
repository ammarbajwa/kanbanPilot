"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canTransition,
  columns,
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

type DemoHealth = {
  status: "ready" | "blocked";
  model: string;
  provider?: string;
  repository: string;
  checks: { name: string; ok: boolean; detail: string }[];
};

type DemoServerRun = WorkflowRun & {
  status: "queued" | "running" | "succeeded" | "failed";
  model: string;
  error?: string;
  worktreePath?: string;
};

const emptyTicket = {
  title: "",
  description: "",
  acceptanceCriteria: "",
  priority: "MEDIUM" as TicketPriority,
  type: "FEATURE" as TicketType,
  labels: "",
};

const statusLabels: Record<TicketStatus, string> = {
  TODO: "To do",
  READY_FOR_AGENT: "Ready for agent",
  IN_PROGRESS: "In progress",
  READY_FOR_REVIEW: "Ready for review",
  DONE: "Done",
};

export default function Home() {
  const [project, setProject] = useState<ProjectConfig>(initialProject);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [workflowRuns, setWorkflowRuns] =
    useState<Record<string, WorkflowRun>>(initialWorkflowRuns);
  const [activeTicketId, setActiveTicketId] = useState(initialTickets[0].id);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [ticketDraft, setTicketDraft] = useState(emptyTicket);
  const [intakePrompt, setIntakePrompt] = useState(
    "Build MergeStamp in kanbanPilot with a dark-mode board, structured project settings, and governed agent workflow gates.",
  );
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<TicketStatus | null>(null);
  const [demoHealth, setDemoHealth] = useState<DemoHealth | null>(null);
  const [demoRunId, setDemoRunId] = useState<string | null>(null);
  const [workerMessage, setWorkerMessage] = useState("Checking local worker...");
  const [prActionBusy, setPrActionBusy] = useState(false);

  const counts = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        count: tickets.filter((ticket) => ticket.status === column.id).length,
      })),
    [tickets],
  );

  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId);
  const activeRun = activeTicket?.workflowRunId
    ? workflowRuns[activeTicket.workflowRunId]
    : undefined;
  const demoTicket = tickets.find((ticket) => ticket.id === "ticket-demo");
  const demoRun = demoRunId
    ? (workflowRuns[demoRunId] as DemoServerRun | undefined)
    : undefined;
  const demoRunning = demoRun?.status === "queued" || demoRun?.status === "running";

  const applyServerRun = useCallback((run: DemoServerRun) => {
    const normalizedRun: DemoServerRun = {
      ...run,
      events: run.events.map((event) => ({
        ...event,
        createdAt: new Date(event.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      })),
    };
    const nextStatus: TicketStatus =
      run.pullRequestState === "MERGED"
        ? "DONE"
        : run.status === "succeeded"
          ? "READY_FOR_REVIEW"
          : "IN_PROGRESS";
    setWorkflowRuns((current) => ({ ...current, [run.id]: normalizedRun }));
    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === run.ticketId
          ? {
              ...ticket,
              status: nextStatus,
              workflowRunId: run.id,
              pullRequestUrl: run.pullRequestUrl,
              branchName: run.branchName,
              latestCommitSha: run.latestCommitSha,
              version: Math.max(ticket.version, run.events.length + 1),
            }
          : ticket,
      ),
    );
    if (run.status === "failed") {
      setValidationMessages([run.error || "The real demo workflow failed."]);
    } else {
      setValidationMessages([]);
    }
  }, []);

  const refreshDemoHealth = useCallback(async () => {
    try {
      const response = await fetch(`${demoWorkerUrl}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Worker returned ${response.status}.`);
      const health = (await response.json()) as DemoHealth;
      setDemoHealth(health);
      setWorkerMessage(
        health.status === "ready" ? "Ready to run" : "Setup required",
      );
    } catch {
      setDemoHealth(null);
      setWorkerMessage("Local worker offline");
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
        setWorkerMessage(health.status === "ready" ? "Ready to run" : "Setup required");
      })
      .catch(() => {
        if (cancelled) return;
        setDemoHealth(null);
        setWorkerMessage("Local worker offline");
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
        if (!cancelled) setWorkerMessage("Lost connection to local worker");
      }
    }

    void poll();
    const interval = window.setInterval(poll, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyServerRun, demoRunId]);

  function updateRequirement(key: keyof ProjectConfig["requirements"], value: string) {
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
          new Set([
            ...current.agentPolicy.allowedCommands,
            value,
          ].filter(Boolean)),
        ),
      },
    }));
  }

  function generateProjectDraft() {
    setProject((current) => ({
      ...current,
      productOverview: intakePrompt,
      goals: [
        "Govern the ticket-to-pull-request workflow from a Kanban board",
        "Persist explicit product, architecture, design, coding, and testing standards",
        "Collect validation and review evidence before human review",
      ],
      intakeTranscript: [
        ...current.intakeTranscript,
        `User: ${intakePrompt}`,
        "Assistant: Drafted MergeStamp configuration with default kanbanPilot repository settings and local validation commands.",
      ],
    }));
  }

  function addTicket() {
    const criteria = ticketDraft.acceptanceCriteria
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!ticketDraft.title.trim() || !ticketDraft.description.trim() || criteria.length === 0) {
      setValidationMessages([
        "Ticket title, description, and at least one acceptance criterion are required.",
      ]);
      return;
    }

    const nextNumber =
      Math.max(...tickets.map((ticket) => ticket.sequenceNumber), 0) + 1;
    const ticket: Ticket = {
      id: `ticket-${Date.now()}`,
      sequenceNumber: nextNumber,
      title: ticketDraft.title.trim(),
      description: ticketDraft.description.trim(),
      acceptanceCriteria: criteria,
      status: "TODO",
      priority: ticketDraft.priority,
      type: ticketDraft.type,
      labels: ticketDraft.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      expectedTests: "Add or update tests that prove the acceptance criteria.",
      manualVerification: "Review the generated PR evidence package.",
      relatedFiles: [],
      comments: [],
      version: 1,
    };

    setTickets((current) => [ticket, ...current]);
    setActiveTicketId(ticket.id);
    setTicketDraft(emptyTicket);
    setValidationMessages([]);
  }

  async function startDemo(ticket: Ticket) {
    const errors = validateReadyForAgent(ticket, project);
    if (errors.length > 0) {
      setValidationMessages(errors);
      return;
    }
    setActiveTicketId(ticket.id);
    setValidationMessages([]);
    setWorkerMessage("Starting real workflow...");
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
          .map((check: DemoHealth["checks"][number]) => `${check.name}: ${check.detail}`);
        throw new Error(failedChecks?.join(" ") || body.error || "Unable to start the demo.");
      }
      const run = body as DemoServerRun;
      setDemoRunId(run.id);
      applyServerRun(run);
      setWorkerMessage("Workflow running");
    } catch (error) {
      setWorkerMessage("Unable to start");
      setValidationMessages([
        error instanceof Error
          ? error.message
          : "Start the local worker with npm run dev:demo.",
      ]);
      void refreshDemoHealth();
    }
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

  function moveTicket(ticketId: string, status: TicketStatus) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket || ticket.status === status) return;

    if (!canTransition(ticket.status, status)) {
      setValidationMessages([
        `${statusLabels[ticket.status]} cannot move directly to ${statusLabels[status]}.`,
      ]);
      return;
    }

    if (status === "READY_FOR_AGENT") {
      void startDemo(ticket);
      return;
    }
    setValidationMessages([
      "Workflow state is controlled by the local worker and the live GitHub pull request.",
    ]);
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-first agentic development Kanban</p>
          <h1>MergeStamp</h1>
          <p className="lede">
            Move a well-specified ticket to Ready for agent and receive a
            tested, independently reviewed pull request in Ready for review.
          </p>
        </div>
        <a className="repo-link" href={project.repository.url}>
          {project.repository.owner}/{project.repository.name}
        </a>
      </header>

      <section className="metrics" aria-label="Board summary">
        {counts.map((column) => (
          <div className="metric" key={column.id}>
            <span>
              {column.title}
              <small>{column.owner}</small>
            </span>
            <strong>{column.count}</strong>
          </div>
        ))}
      </section>

      <section className="demo-console" aria-labelledby="demo-heading">
        <div className="demo-console-heading">
          <div>
            <p className="eyebrow">Real end-to-end demo</p>
            <h2 id="demo-heading">MS-1: Hello world to draft PR</h2>
          </div>
          <span
            className={`worker-state ${
              demoHealth?.status === "ready" ? "is-ready" : "is-blocked"
            }`}
          >
            {workerMessage}
          </span>
        </div>

        <div className="demo-flow" aria-label="Workflow stages">
          <span>LLM tools</span>
          <span>Worktree</span>
          <span>Tests</span>
          <span>Commit</span>
          <span>Push</span>
          <span>Draft PR</span>
        </div>

        <div className="preflight-grid">
          {demoHealth ? (
            demoHealth.checks.map((check) => (
              <div className="preflight-check" key={check.name}>
                <span className={check.ok ? "check-ok" : "check-failed"}>
                  {check.ok ? "Ready" : "Blocked"}
                </span>
                <strong>{check.name}</strong>
                <small>{check.detail}</small>
              </div>
            ))
          ) : (
            <div className="preflight-check offline-check">
              <span className="check-failed">Offline</span>
              <strong>Local demo worker</strong>
              <small>Start MergeStamp with npm run dev:demo.</small>
            </div>
          )}
        </div>

        <div className="demo-actions">
          <button
            type="button"
            disabled={!demoTicket || demoRunning || demoHealth?.status !== "ready"}
            onClick={() => demoTicket && void startDemo(demoTicket)}
          >
            {demoRunning
              ? "Workflow running"
              : demoRun?.status === "failed"
                ? "Retry real workflow"
                : "Run real workflow"}
          </button>
          <button className="secondary-button" type="button" onClick={() => void refreshDemoHealth()}>
            Recheck setup
          </button>
          {demoRun?.pullRequestUrl ? (
            <a className="secondary-link" href={demoRun.pullRequestUrl} target="_blank" rel="noreferrer">
              Open pull request
            </a>
          ) : null}
        </div>

        <div className="execution-ownership">
          <span><strong>LLM</strong> receives the selected ticket and writes only its demo/ scope</span>
          <span><strong>Worker</strong> owns git, checks, commits, push, and gh</span>
          <span><strong>Provider</strong> {demoHealth?.provider || "AkashML"}</span>
          <span><strong>Model</strong> {(demoHealth?.model || "zai-org--GLM-5.2").replace("--", "/")}</span>
        </div>
      </section>

      {validationMessages.length > 0 ? (
        <section className="notice" aria-live="polite">
          <strong>Validation</strong>
          <ul>
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="workspace-grid">
        <section className="project-panel" aria-labelledby="project-heading">
          <div className="section-heading">
            <p className="eyebrow">Project</p>
            <h2 id="project-heading">{project.name}</h2>
          </div>
          <p>{project.description}</p>

          <div className="intake-box">
            <label htmlFor="intake">AI-assisted project intake</label>
            <textarea
              id="intake"
              value={intakePrompt}
              onChange={(event) => setIntakePrompt(event.target.value)}
            />
            <button type="button" onClick={generateProjectDraft}>
              Generate draft configuration
            </button>
          </div>

          <div className="detail-grid">
            <label>
              Repository URL
              <input
                value={project.repository.url}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    repository: {
                      ...current.repository,
                      url: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              Local path
              <input
                value={project.repository.localPath}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    repository: {
                      ...current.repository,
                      localPath: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              Test command
              <input
                value={project.commands.test}
                onChange={(event) => updateCommand("test", event.target.value)}
              />
            </label>
            <label>
              Lint command
              <input
                value={project.commands.lint}
                onChange={(event) => updateCommand("lint", event.target.value)}
              />
            </label>
            <label>
              Build command
              <input
                value={project.commands.build}
                onChange={(event) => updateCommand("build", event.target.value)}
              />
            </label>
            <label>
              Max changed files
              <input
                min="1"
                type="number"
                value={project.agentPolicy.maxFilesChanged}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    agentPolicy: {
                      ...current.agentPolicy,
                      maxFilesChanged: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="project-panel" aria-labelledby="requirements-heading">
          <div className="section-heading">
            <p className="eyebrow">Requirements</p>
            <h2 id="requirements-heading">Operating standards</h2>
          </div>
          <div className="requirements-list">
            {Object.entries(project.requirements).map(([key, value]) => (
              <label key={key}>
                {key}
                <textarea
                  value={value}
                  onChange={(event) =>
                    updateRequirement(
                      key as keyof ProjectConfig["requirements"],
                      event.target.value,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="ticket-composer" aria-labelledby="ticket-heading">
        <div className="section-heading">
          <p className="eyebrow">Ticket intake</p>
          <h2 id="ticket-heading">Create work for the governed queue</h2>
        </div>
        <div className="composer-grid">
          <label>
            Title
            <input
              value={ticketDraft.title}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Priority
            <select
              value={ticketDraft.priority}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  priority: event.target.value as TicketPriority,
                }))
              }
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>URGENT</option>
            </select>
          </label>
          <label>
            Type
            <select
              value={ticketDraft.type}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  type: event.target.value as TicketType,
                }))
              }
            >
              <option>FEATURE</option>
              <option>BUG</option>
              <option>REFACTOR</option>
              <option>TEST</option>
              <option>DOCS</option>
              <option>MAINTENANCE</option>
            </select>
          </label>
          <label>
            Labels
            <input
              placeholder="ui, workflow"
              value={ticketDraft.labels}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  labels: event.target.value,
                }))
              }
            />
          </label>
          <label className="wide">
            Description
            <textarea
              value={ticketDraft.description}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label className="wide">
            Acceptance criteria
            <textarea
              placeholder="One criterion per line"
              value={ticketDraft.acceptanceCriteria}
              onChange={(event) =>
                setTicketDraft((current) => ({
                  ...current,
                  acceptanceCriteria: event.target.value,
                }))
              }
            />
          </label>
          <button type="button" onClick={addTicket}>
            Add ticket
          </button>
        </div>
      </section>

      <section className="board" aria-label="Kanban board">
        {counts.map((column) => (
          <div
            className={`column ${dragTarget === column.id ? "drag-over" : ""}`}
            data-status={column.id}
            key={column.id}
            onDragLeave={() => setDragTarget(null)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragTarget(column.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/plain");
              if (taskId) {
                moveTicket(taskId, column.id);
              }
              setDraggingTaskId(null);
              setDragTarget(null);
            }}
          >
            <div className="column-heading">
              <h2>{column.title}</h2>
              <span>{column.count}</span>
            </div>
            <div className="task-list">
              {tickets
                .filter((ticket) => ticket.status === column.id)
                .map((ticket) => {
                  const run = ticket.workflowRunId
                    ? workflowRuns[ticket.workflowRunId]
                    : undefined;
                  return (
                  <article
                    className={`task-card ${
                      draggingTaskId === ticket.id ? "dragging" : ""
                    }`}
                    draggable
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                    onDragEnd={() => {
                      setDraggingTaskId(null);
                      setDragTarget(null);
                    }}
                    onDragStart={(event) => {
                      setDraggingTaskId(ticket.id);
                      event.dataTransfer.setData("text/plain", ticket.id);
                    }}
                  >
                    <div className="card-topline">
                      <span>MS-{ticket.sequenceNumber}</span>
                      <span>{ticket.priority}</span>
                    </div>
                    <h3>{ticket.title}</h3>
                    <p>{ticket.description}</p>
                    <div className="tag-row">
                      <span className="tag">{ticket.type}</span>
                      {ticket.labels.map((label) => (
                        <span className="tag muted-tag" key={label}>
                          {label}
                        </span>
                      ))}
                    </div>
                    {run ? (
                      <div className="run-chip">
                        <span>{run.state.replaceAll("_", " ")}</span>
                        <strong>{run.evidence.review}</strong>
                      </div>
                    ) : null}
                    <div className="card-actions">
                      {ticket.status === "TODO" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            moveTicket(ticket.id, "READY_FOR_AGENT");
                          }}
                        >
                          Send to agent
                        </button>
                      ) : null}
                      {ticket.status === "IN_PROGRESS" ? (
                        <button
                          type="button"
                          disabled={demoRunning}
                          onClick={(event) => {
                            event.stopPropagation();
                            void startDemo(ticket);
                          }}
                        >
                          {demoRunning ? "Running" : "Retry workflow"}
                        </button>
                      ) : null}
                      {ticket.status === "READY_FOR_REVIEW" ? (
                        <>
                          <button
                            type="button"
                            disabled={prActionBusy || !run || run.pullRequestState !== "DRAFT"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (run) void runPullRequestAction(run.id, "ready");
                            }}
                          >
                            Mark PR ready
                          </button>
                          <button
                            type="button"
                            disabled={prActionBusy || !run}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (run) void runPullRequestAction(run.id, "sync");
                            }}
                          >
                            Sync GitHub
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                  );
                })}
            </div>
          </div>
        ))}
      </section>

      <section className="ticket-detail" aria-labelledby="detail-heading">
        <div className="section-heading">
          <p className="eyebrow">Workflow history</p>
          <h2 id="detail-heading">
            {activeTicket ? `MS-${activeTicket.sequenceNumber}: ${activeTicket.title}` : "No ticket selected"}
          </h2>
        </div>
        {activeTicket ? (
          <TicketDetail
            ticket={activeTicket}
            run={activeRun}
            onAddComment={addComment}
          />
        ) : null}
      </section>
    </main>
  );
}

function TicketDetail({
  ticket,
  run,
  onAddComment,
}: {
  ticket: Ticket;
  run?: WorkflowRun;
  onAddComment: (ticketId: string, comment: string) => void;
}) {
  const [comment, setComment] = useState("");

  return (
    <div className="detail-layout">
      <div>
        <div className="status-strip">
          <span>{statusLabels[ticket.status]}</span>
          <span>Version {ticket.version}</span>
          {ticket.branchName ? <span>{ticket.branchName}</span> : null}
        </div>
        <h3>Acceptance criteria</h3>
        <ul className="check-list">
          {ticket.acceptanceCriteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
        <h3>Comments</h3>
        <div className="comment-list">
          {ticket.comments.length > 0 ? (
            ticket.comments.map((item) => <p key={item}>{item}</p>)
          ) : (
            <p>No comments yet.</p>
          )}
        </div>
        <div className="comment-box">
          <input
            placeholder="Add human review context"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              onAddComment(ticket.id, comment);
              setComment("");
            }}
          >
            Add comment
          </button>
        </div>
      </div>

      <div className="evidence-panel">
        <h3>Evidence package</h3>
        {run ? (
          <>
            <dl>
              <div>
                <dt>Pull request</dt>
                <dd>
                  {run.pullRequestUrl ? (
                    <a href={run.pullRequestUrl}>{run.pullRequestUrl}</a>
                  ) : (
                    "Pending"
                  )}
                </dd>
              </div>
              <div>
                <dt>Tests</dt>
                <dd>{run.evidence.tests}</dd>
              </div>
              <div>
                <dt>PR state</dt>
                <dd>{run.pullRequestState || "Pending"}</dd>
              </div>
              <div>
                <dt>Lint</dt>
                <dd>{run.evidence.lint}</dd>
              </div>
              <div>
                <dt>Build</dt>
                <dd>{run.evidence.build}</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>{run.evidence.review}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{run.evidence.risk}</dd>
              </div>
            </dl>
            <h4>Changed files</h4>
            <ul className="file-list">
              {run.evidence.changedFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
            <h4>Assumptions</h4>
            <ul className="check-list">
              {run.evidence.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Workflow evidence appears after the ticket enters Ready for agent.</p>
        )}
      </div>

      <div className="timeline">
        <h3>Timeline</h3>
        {run ? (
          run.events.map((event) => (
            <div className="timeline-item" key={event.id}>
              <time>{event.createdAt}</time>
              <div>
                <strong>{event.step}</strong>
                <span>{event.status}</span>
                <p>{event.message}</p>
              </div>
            </div>
          ))
        ) : (
          <p>No workflow run has started.</p>
        )}
      </div>
    </div>
  );
}
