"use client";

import { useState } from "react";
import type { Ticket, WorkflowRun } from "./mergestamp-domain";
import { useMergeStamp } from "./mergestamp-provider";
import { EventMessage } from "./event-message";

const statusLabels = {
  TODO: "Todo",
  READY_FOR_AGENT: "Ready for agent",
  REVISION_QUEUED: "Revision queued",
  IN_PROGRESS: "Working",
  READY_FOR_REVIEW: "Review",
  DONE: "Done",
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TicketDetail({
  ticket,
  run,
}: {
  ticket: Ticket;
  run?: WorkflowRun;
}) {
  const {
    addComment,
    requestRevision,
    runPullRequestAction,
    prActionBusy,
    revisionBusy,
  } = useMergeStamp();
  const [comment, setComment] = useState("");

  return (
    <div className="ticket-detail">
      <header className="detail-header">
        <p className="eyebrow">MS-{ticket.sequenceNumber}</p>
        <h2>{ticket.title}</h2>
        <div className="status-strip">
          <span>{statusLabels[ticket.status]}</span>
          <span>Version {ticket.version}</span>
        </div>
        <p>{ticket.description}</p>
      </header>

      {run ? (
        <section className="detail-section">
          <div className="detail-section-heading">
            <h3>Pull request</h3>
            <span>{run.pullRequestState || "Pending"}</span>
          </div>
          <div className="pr-summary">
            <dl>
              <div>
                <dt>Tests</dt>
                <dd>{run.evidence.tests}</dd>
              </div>
              <div>
                <dt>Checks</dt>
                <dd>{run.evidence.lint}</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>{run.evidence.review}</dd>
              </div>
            </dl>
            <div className="form-actions align-start">
              {run.pullRequestUrl ? (
                <a className="secondary-link" href={run.pullRequestUrl} target="_blank" rel="noreferrer">
                  Open PR
                </a>
              ) : null}
              {run.pullRequestState === "DRAFT" ? (
                <button
                  type="button"
                  disabled={prActionBusy}
                  onClick={() => void runPullRequestAction(run.id, "ready")}
                >
                  Mark ready
                </button>
              ) : null}
              <button
                className="secondary-button"
                type="button"
                disabled={prActionBusy || !run.pullRequestUrl}
                onClick={() => void runPullRequestAction(run.id, "sync")}
              >
                Sync GitHub
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h3>Acceptance criteria</h3>
        <ul className="check-list">
          {ticket.acceptanceCriteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Review notes</h3>
        <div className="comment-list">
          {ticket.comments.length > 0 ? (
            ticket.comments.map((item) => <p key={item}>{item}</p>)
          ) : (
            <p>No review notes yet.</p>
          )}
        </div>
        <div className="comment-box">
          <textarea
            rows={3}
            placeholder="Add review context or describe what should change"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="comment-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={!comment.trim()}
              onClick={() => {
                addComment(ticket.id, comment);
                setComment("");
              }}
            >
              Add note
            </button>
            {ticket.status === "READY_FOR_REVIEW" ? (
              <button
                type="button"
                disabled={!comment.trim() || revisionBusy}
                onClick={() => {
                  void requestRevision(ticket.id, comment).then((queued) => {
                    if (queued) setComment("");
                  });
                }}
              >
                {revisionBusy ? "Queueing..." : "Request changes"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h3>Timeline</h3>
        {run?.events.length ? (
          <ol className="timeline-list">
            {[...run.events].reverse().map((event) => (
              <li key={event.id}>
                <time>{formatTime(event.createdAt)}</time>
                <div>
                  <strong>{event.step}</strong>
                  <span className={`event-status ${event.status.toLowerCase()}`}>
                    {event.status}
                  </span>
                  <EventMessage message={event.message} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">No workflow activity yet.</p>
        )}
      </section>
    </div>
  );
}
