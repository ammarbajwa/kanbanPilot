"use client";

import { useState } from "react";
import {
  boardColumnForStatus,
  columns,
  type TicketStatus,
} from "./mergestamp-domain";
import { MergeStampShell } from "./mergestamp-shell";
import { useMergeStamp } from "./mergestamp-provider";
import { TicketDetail } from "./ticket-detail";

export default function BoardPage() {
  const {
    tickets,
    workflowRuns,
    activeTicket,
    activeRun,
    setActiveTicketId,
    ticketDraft,
    setTicketDraft,
    addTicket,
    moveTicket,
    startWorkflow,
    requestRevision,
    demoRunning,
    revisionBusy,
  } = useMergeStamp();
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<TicketStatus | null>(null);

  const counts = columns.map((column) => ({
    ...column,
    count: tickets.filter(
      (ticket) => boardColumnForStatus(ticket.status) === column.id,
    ).length,
  }));

  function createTicket() {
    if (addTicket()) {
      setComposerOpen(false);
      setDetailOpen(true);
    }
  }

  return (
    <MergeStampShell
      title="Board"
      description="Create work, start an agent, and review the resulting pull request."
      actions={
        <button type="button" onClick={() => setComposerOpen((open) => !open)}>
          {composerOpen ? "Close" : "+ New todo"}
        </button>
      }
    >
      {composerOpen ? (
        <section className="todo-composer" aria-labelledby="new-todo-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">New todo</p>
              <h2 id="new-todo-heading">Describe the outcome</h2>
            </div>
          </div>
          <div className="quick-todo-grid">
            <label>
              Title
              <input
                autoFocus
                value={ticketDraft.title}
                onChange={(event) =>
                  setTicketDraft((current) => ({
                    ...current,
                    title: event.target.value,
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
          </div>
          <details className="advanced-options">
            <summary>More options</summary>
            <div className="advanced-grid">
              <label>
                Priority
                <select
                  value={ticketDraft.priority}
                  onChange={(event) =>
                    setTicketDraft((current) => ({
                      ...current,
                      priority: event.target.value as typeof current.priority,
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
                      type: event.target.value as typeof current.type,
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
            </div>
          </details>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setComposerOpen(false)}>
              Cancel
            </button>
            <button type="button" onClick={createTicket}>
              Create todo
            </button>
          </div>
        </section>
      ) : null}

      <div className="board-scroll">
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
              const ticket = tickets.find((item) => item.id === taskId);
              if (
                ticket &&
                boardColumnForStatus(ticket.status) !== column.id
              ) {
                moveTicket(taskId, column.id);
              }
              setDraggingTaskId(null);
              setDragTarget(null);
            }}
          >
            <div className="column-heading">
              <div>
                <h2>{column.title}</h2>
                <small>{column.owner}</small>
              </div>
              <span>{column.count}</span>
            </div>
            <div className="task-list">
              {tickets
                .filter(
                  (ticket) =>
                    boardColumnForStatus(ticket.status) === column.id,
                )
                .map((ticket) => {
                  const run = ticket.workflowRunId
                    ? workflowRuns[ticket.workflowRunId]
                    : undefined;
                  return (
                    <article
                      className={`task-card ${draggingTaskId === ticket.id ? "dragging" : ""}`}
                      draggable
                      key={ticket.id}
                      onClick={() => {
                        setActiveTicketId(ticket.id);
                        setDetailOpen(true);
                      }}
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
                      {run ? (
                        <div className="run-chip">
                          <span>{run.state.replaceAll("_", " ")}</span>
                          <strong>{run.evidence.review}</strong>
                        </div>
                      ) : null}
                      <div className="tag-row">
                        <span className="tag">{ticket.type}</span>
                        {ticket.status === "REVISION_QUEUED" ? (
                          <span className="tag revision-tag">Revision queued</span>
                        ) : null}
                        {ticket.labels.map((label) => (
                          <span className="tag muted-tag" key={label}>
                            {label}
                          </span>
                        ))}
                      </div>
                      <div className="card-actions">
                        {ticket.status === "TODO" ? (
                          <button
                            type="button"
                            disabled={demoRunning}
                            onClick={(event) => {
                              event.stopPropagation();
                              moveTicket(ticket.id, "READY_FOR_AGENT");
                            }}
                          >
                            {demoRunning ? "Worker busy" : "Run agent"}
                          </button>
                        ) : null}
                        {ticket.status === "IN_PROGRESS" && run?.state === "FAILED" ? (
                          <button
                            type="button"
                            disabled={demoRunning || revisionBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              const feedback = ticket.comments
                                .at(-1)
                                ?.replace(/^Revision \d+:\s*/, "");
                              if (run.revisionCount > 0 && feedback) {
                                void requestRevision(ticket.id, feedback);
                              } else {
                                void startWorkflow(ticket);
                              }
                            }}
                          >
                            {revisionBusy ? "Retrying..." : "Retry"}
                          </button>
                        ) : null}
                        {ticket.status === "REVISION_QUEUED" && run ? (
                          <button
                            type="button"
                            disabled={demoRunning || revisionBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              const feedback = ticket.comments
                                .at(-1)
                                ?.replace(/^Revision \d+:\s*/, "");
                              if (feedback) void requestRevision(ticket.id, feedback);
                            }}
                          >
                            {revisionBusy ? "Starting..." : "Resume revision"}
                          </button>
                        ) : null}
                        {ticket.pullRequestUrl ? (
                          <a
                            className="secondary-link"
                            href={ticket.pullRequestUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open PR
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
          ))}
        </section>
      </div>

      {detailOpen && activeTicket ? (
        <div className="drawer-backdrop" onMouseDown={() => setDetailOpen(false)}>
          <aside
            className="ticket-drawer"
            aria-label={`MS-${activeTicket.sequenceNumber} details`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button drawer-close"
              type="button"
              aria-label="Close ticket details"
              title="Close"
              onClick={() => setDetailOpen(false)}
            >
              ×
            </button>
            <TicketDetail ticket={activeTicket} run={activeRun} />
          </aside>
        </div>
      ) : null}
    </MergeStampShell>
  );
}
