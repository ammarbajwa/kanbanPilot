"use client";

import { MergeStampShell } from "../mergestamp-shell";
import { useMergeStamp } from "../mergestamp-provider";

export default function SettingsPage() {
  const {
    project,
    setProject,
    intakePrompt,
    setIntakePrompt,
    generateProjectDraft,
    updateCommand,
    updateRequirement,
    demoHealth,
    workerMessage,
    refreshDemoHealth,
  } = useMergeStamp();

  return (
    <MergeStampShell
      title="Settings"
      description="Repository, commands, model access, policies, and setup checks."
      actions={
        <button className="secondary-button" type="button" onClick={() => void refreshDemoHealth()}>
          Recheck setup
        </button>
      }
    >
      <div className="settings-layout">
        <section className="settings-section setup-section" aria-labelledby="setup-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Runtime</p>
              <h2 id="setup-heading">Setup checks</h2>
            </div>
            <span className={`worker-pill ${demoHealth?.status === "ready" ? "ready" : "blocked"}`}>
              {workerMessage}
            </span>
          </div>
          <div className="preflight-list">
            {demoHealth ? (
              demoHealth.checks.map((check) => (
                <div className="preflight-row" key={check.name}>
                  <span className={`status-dot ${check.ok ? "ready" : "blocked"}`} aria-hidden="true" />
                  <strong>{check.name}</strong>
                  <small>{check.detail}</small>
                </div>
              ))
            ) : (
              <div className="empty-state compact-empty">
                <h3>Worker unavailable</h3>
                <p>Start the local worker with `npm run dev:demo`.</p>
              </div>
            )}
          </div>
          <dl className="provider-details">
            <div>
              <dt>Provider</dt>
              <dd>{demoHealth?.provider || "AkashML"}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{(demoHealth?.model || "zai-org--GLM-5.2").replace("--", "/")}</dd>
            </div>
          </dl>
        </section>

        <section className="settings-section" aria-labelledby="project-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Project</p>
              <h2 id="project-heading">Repository and commands</h2>
            </div>
          </div>
          <div className="settings-grid">
            <label>
              Project name
              <input
                value={project.name}
                onChange={(event) =>
                  setProject((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label>
              Repository URL
              <input
                value={project.repository.url}
                onChange={(event) =>
                  setProject((current) => ({
                    ...current,
                    repository: { ...current.repository, url: event.target.value },
                  }))
                }
              />
            </label>
            <label className="wide">
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

        <section className="settings-section" aria-labelledby="intake-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Project context</p>
              <h2 id="intake-heading">AI-assisted configuration</h2>
            </div>
          </div>
          <label>
            Product direction
            <textarea
              value={intakePrompt}
              onChange={(event) => setIntakePrompt(event.target.value)}
            />
          </label>
          <div className="form-actions align-start">
            <button type="button" onClick={generateProjectDraft}>
              Update configuration
            </button>
          </div>
        </section>

        <section className="settings-section full-width" aria-labelledby="standards-heading">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Policy</p>
              <h2 id="standards-heading">Operating standards</h2>
            </div>
          </div>
          <div className="requirements-list">
            {Object.entries(project.requirements).map(([key, value]) => (
              <label key={key}>
                {key}
                <textarea
                  value={value}
                  onChange={(event) =>
                    updateRequirement(
                      key as keyof typeof project.requirements,
                      event.target.value,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </MergeStampShell>
  );
}
