"use client";

import { MergeStampShell } from "../mergestamp-shell";
import { useMergeStamp } from "../mergestamp-provider";
import { EventMessage } from "../event-message";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ActivityPage() {
  const { tickets, workflowRuns } = useMergeStamp();
  const runs = Object.values(workflowRuns).sort((left, right) => {
    const leftTime = left.events.at(-1)?.createdAt || "";
    const rightTime = right.events.at(-1)?.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
  const eventCount = runs.reduce((total, run) => total + run.events.length, 0);
  const activeCount = runs.filter((run) =>
    ["QUEUED", "REVISION_QUEUED", "VALIDATING_TICKET", "LOADING_CONTEXT", "PLANNING", "BUILDING", "LOCAL_VALIDATION", "CREATING_PR", "CI_RUNNING", "REVIEWING"].includes(run.state),
  ).length;

  return (
    <MergeStampShell
      title="Activity"
      description="Project-wide history for agent runs, validation, commits, and pull requests."
    >
      <section className="activity-summary" aria-label="Activity summary">
        <div>
          <span>Runs</span>
          <strong>{runs.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Events</span>
          <strong>{eventCount}</strong>
        </div>
      </section>

      <section className="activity-feed" aria-label="Execution timeline">
        {runs.length > 0 ? (
          runs.map((run) => {
            const ticket = tickets.find((item) => item.id === run.ticketId);
            return (
              <article className="run-activity" key={run.id}>
                <header>
                  <div>
                    <p className="eyebrow">
                      {ticket ? `MS-${ticket.sequenceNumber}` : run.ticketId}
                    </p>
                    <h2>{ticket?.title || "Workflow run"}</h2>
                  </div>
                  <div className="run-state">
                    <span>{run.state.replaceAll("_", " ")}</span>
                    {run.pullRequestUrl ? (
                      <a href={run.pullRequestUrl} target="_blank" rel="noreferrer">
                        Open PR
                      </a>
                    ) : null}
                  </div>
                </header>
                <ol className="timeline-list global-timeline">
                  {[...run.events].reverse().map((event) => (
                    <li key={event.id}>
                      <time>{formatTimestamp(event.createdAt)}</time>
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
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            <h2>No activity yet</h2>
            <p>Start an agent from the Board and its progress will appear here.</p>
          </div>
        )}
      </section>
    </MergeStampShell>
  );
}
