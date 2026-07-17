import { mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { commandCheck, CommandError, runCommand } from "./command.mjs";
import { DEMO_CONFIG, DEMO_TICKET } from "./config.mjs";
import { runCodingAgent, validateRelativePath } from "./akash-agent.mjs";

function timestamp() {
  return new Date().toISOString();
}

export function addEvent(run, step, status, message) {
  run.events.push({
    id: `${run.id}-${run.events.length + 1}`,
    step,
    status,
    message,
    createdAt: timestamp(),
  });
}

function branchSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "ticket";
}

export function normalizeTicket(input) {
  if (!input || typeof input !== "object") throw new Error("A ticket is required.");
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const sequenceNumber = Number(input.sequenceNumber);
  const acceptanceCriteria = Array.isArray(input.acceptanceCriteria)
    ? input.acceptanceCriteria.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Ticket id is invalid.");
  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 999_999) {
    throw new Error("Ticket sequence number is invalid.");
  }
  if (!title || title.length > 200) throw new Error("Ticket title must be 1-200 characters.");
  if (!description || description.length > 2_000) {
    throw new Error("Ticket description must be 1-2,000 characters.");
  }
  if (acceptanceCriteria.length < 1 || acceptanceCriteria.length > 12) {
    throw new Error("Ticket must have 1-12 acceptance criteria.");
  }
  if (acceptanceCriteria.some((criterion) => criterion.length > 500)) {
    throw new Error("Each acceptance criterion must be 500 characters or fewer.");
  }

  return { id, sequenceNumber, title, description, acceptanceCriteria };
}

export function createRun(ticketInput = DEMO_TICKET) {
  const ticket = normalizeTicket(ticketInput);
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const id = `demo-${suffix}`;
  const scope = `demo/runs/ms-${ticket.sequenceNumber}-${suffix}`;
  return {
    id,
    ticket,
    ticketId: ticket.id,
    status: "queued",
    state: "QUEUED",
    attempt: 1,
    revisionCount: 0,
    branchName: `codex/mergestamp-ms-${ticket.sequenceNumber}-${branchSlug(ticket.title)}-${suffix}`,
    scope,
    model: DEMO_CONFIG.model,
    pullRequestState: null,
    events: [],
    evidence: {
      tests: "Pending",
      lint: "Pending",
      build: "Pending",
      review: "Pending",
      changedFiles: [],
      assumptions: [],
      risk: "LOW",
    },
  };
}

export async function getPreflight() {
  const cwd = DEMO_CONFIG.repositoryRoot;
  const checks = [];
  const akashKey = process.env.AKASHML_API_KEY;
  if (!akashKey) {
    checks.push({
      name: "AkashML authentication",
      ok: false,
      detail: "Add AKASHML_API_KEY to .env.local",
    });
  } else {
    try {
      const response = await fetch(`${DEMO_CONFIG.akashApiBase.replace(/\/$/, "")}/v1/models`, {
        headers: { Authorization: `Bearer ${akashKey}` },
      });
      const body = await response.json().catch(() => ({}));
      const models = Array.isArray(body.data) ? body.data : [];
      const upstreamModel = DEMO_CONFIG.model.replace("--", "/");
      checks.push({
        name: "AkashML authentication",
        ok: response.ok && models.some((model) => model.id === upstreamModel),
        detail: response.ok
          ? models.some((model) => model.id === upstreamModel)
            ? "Authenticated; GLM 5.2 available"
            : "Authenticated, but GLM 5.2 is unavailable to this key"
          : body.error?.message || body.message || `AkashML returned ${response.status}`,
      });
    } catch (error) {
      checks.push({
        name: "AkashML authentication",
        ok: false,
        detail: error instanceof Error ? error.message : "Unable to reach AkashML",
      });
    }
  }
  checks.push(await commandCheck("Git repository", "git", ["rev-parse", "--show-toplevel"], { cwd }));
  const github = await commandCheck(
    "GitHub authentication",
    "gh",
    ["auth", "status", "--hostname", "github.com"],
    { cwd },
  );
  if (github.ok) github.detail = "Authenticated with GitHub CLI";
  checks.push(github);
  const identity = await commandCheck("Git identity", "git", ["config", "user.email"], { cwd });
  if (identity.ok) identity.detail = "Configured";
  checks.push(identity);
  checks.push(await commandCheck("Origin remote", "git", ["remote", "get-url", "origin"], { cwd }));
  const alignment = await commandCheck(
    "Base branch alignment",
    "git",
    ["rev-list", "--left-right", "--count", `origin/${DEMO_CONFIG.baseBranch}...HEAD`],
    { cwd },
  );
  if (alignment.ok && !/^0\s+0$/.test(alignment.detail)) {
    alignment.ok = false;
    alignment.detail = `Local HEAD must match origin/${DEMO_CONFIG.baseBranch}; found ${alignment.detail}.`;
  }
  checks.push(alignment);

  return {
    status: checks.every((check) => check.ok) ? "ready" : "blocked",
    model: DEMO_CONFIG.model,
    provider: DEMO_CONFIG.provider,
    repository: DEMO_CONFIG.repository,
    ticket: DEMO_TICKET,
    checks,
  };
}

function changedFilePaths(porcelain) {
  return porcelain
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1));
}

async function validateChanges(run) {
  const status = await runCommand(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: run.worktreePath },
  );
  const changedFiles = changedFilePaths(status.stdout);
  if (changedFiles.length === 0) throw new Error("The agent did not change any files.");
  if (changedFiles.length > DEMO_CONFIG.maxChangedFiles) {
    throw new Error(`The agent changed ${changedFiles.length} files; the limit is ${DEMO_CONFIG.maxChangedFiles}.`);
  }
  for (const file of changedFiles) {
    validateRelativePath(file, { write: true, writableRoot: run.scope });
  }
  run.evidence.changedFiles = changedFiles;

  const testFiles = changedFiles.filter((file) => file.endsWith(".test.mjs"));
  if (testFiles.length === 0) {
    throw new Error("The agent must add at least one .test.mjs file.");
  }
  const scopePath = await realpath(path.join(run.worktreePath, run.scope));
  const scopedTestFiles = testFiles.map((file) => path.posix.relative(run.scope, file));
  const tests = await runCommand(
    "node",
    [
      "--permission",
      `--allow-fs-read=${scopePath}`,
      "--test-isolation=none",
      "--test",
      ...scopedTestFiles,
    ],
    {
      cwd: scopePath,
      env: {
        PATH: process.env.PATH,
        NODE_NO_WARNINGS: "1",
      },
      timeoutMs: 30_000,
    },
  );
  run.evidence.tests = tests.stdout.split("\n").find((line) => line.startsWith("# pass")) || "Passed";
  run.evidence.build = `${changedFiles.length} scoped file${changedFiles.length === 1 ? "" : "s"} generated`;

  await runCommand("git", ["diff", "--check"], { cwd: run.worktreePath });
  run.evidence.lint = "git diff --check passed";
}

function toolMessage(call) {
  try {
    const args = JSON.parse(call.arguments || "{}");
    return `${call.name} ${args.path || "repository"}`;
  } catch {
    return call.name;
  }
}

export async function executeWorkflow(run) {
  run.status = "running";
  run.state = "VALIDATING_TICKET";
  addEvent(
    run,
    "Ticket claimed",
    "SUCCEEDED",
    `The local worker claimed MS-${run.ticket.sequenceNumber}.`,
  );

  try {
    const root = path.join(tmpdir(), "mergestamp-demo");
    await mkdir(root, { recursive: true });
    run.worktreePath = path.join(root, run.id);
    addEvent(run, "Worktree", "STARTED", `Creating isolated branch ${run.branchName}.`);
    await runCommand(
      "git",
      ["worktree", "add", "-b", run.branchName, run.worktreePath, "HEAD"],
      { cwd: DEMO_CONFIG.repositoryRoot },
    );
    addEvent(run, "Worktree", "SUCCEEDED", "Isolated checkout created from local HEAD.");

    run.state = "BUILDING";
    addEvent(run, "LLM implementation", "STARTED", `Calling ${run.model} with bounded repository tools.`);
    let summary = await runCodingAgent({
      root: run.worktreePath,
      ticket: run.ticket,
      writableRoot: run.scope,
      onToolCall(call) {
        addEvent(run, `LLM tool: ${call.name}`, call.ok ? "SUCCEEDED" : "FAILED", toolMessage(call));
      },
    });
    run.modelSummary = summary;
    addEvent(run, "LLM implementation", "SUCCEEDED", summary);

    run.state = "LOCAL_VALIDATION";
    addEvent(
      run,
      "Local validation",
      "STARTED",
      "Running sandboxed node:test and diff checks.",
    );
    try {
      await validateChanges(run);
    } catch (firstError) {
      const feedback = firstError instanceof CommandError
        ? `${firstError.message}\n${firstError.result.stdout}\n${firstError.result.stderr}`
        : firstError instanceof Error
          ? firstError.message
          : String(firstError);
      addEvent(run, "Local validation", "FAILED", "First pass failed; returning the evidence to the LLM once.");
      run.revisionCount = 1;
      run.state = "BUILDING";
      summary = await runCodingAgent({
        root: run.worktreePath,
        ticket: run.ticket,
        writableRoot: run.scope,
        feedback,
        onToolCall(call) {
          addEvent(run, `Revision tool: ${call.name}`, call.ok ? "SUCCEEDED" : "FAILED", toolMessage(call));
        },
      });
      run.modelSummary = summary;
      run.state = "LOCAL_VALIDATION";
      await validateChanges(run);
    }
    addEvent(run, "Local validation", "SUCCEEDED", "All deterministic checks passed.");

    await runCommand("git", ["add", "--", run.scope], { cwd: run.worktreePath });
    await runCommand("git", ["commit", "-m", `feat: implement MS-${run.ticket.sequenceNumber} ticket`], {
      cwd: run.worktreePath,
    });
    const commit = await runCommand("git", ["rev-parse", "HEAD"], { cwd: run.worktreePath });
    run.latestCommitSha = commit.stdout;
    addEvent(run, "Commit", "SUCCEEDED", commit.stdout.slice(0, 12));

    run.state = "CREATING_PR";
    await runCommand("git", ["push", "-u", "origin", run.branchName], { cwd: run.worktreePath });
    addEvent(run, "Push", "SUCCEEDED", `Pushed ${run.branchName} to origin.`);

    const bodyPath = path.join(root, `${run.id}-pr.md`);
    const changed = run.evidence.changedFiles.map((file) => `- \`${file}\``).join("\n");
    await writeFile(
      bodyPath,
      `## Ticket\n\nMS-${run.ticket.sequenceNumber}: ${run.ticket.title}\n\n${run.ticket.description}\n\n## Acceptance criteria\n\n${run.ticket.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")}\n\n## Implementation\n\n${run.modelSummary}\n\n## Evidence\n\n- Tests: ${run.evidence.tests}\n- Generated output: ${run.evidence.build}\n- Diff check: ${run.evidence.lint}\n\n## Changed files\n\n${changed}\n\nGenerated by the MergeStamp local demo worker.`,
      "utf8",
    );
    const pr = await runCommand(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        DEMO_CONFIG.repository,
        "--base",
        DEMO_CONFIG.baseBranch,
        "--head",
        run.branchName,
        "--title",
        `MS-${run.ticket.sequenceNumber}: ${run.ticket.title}`,
        "--body-file",
        bodyPath,
        "--draft",
      ],
      { cwd: run.worktreePath },
    );
    run.pullRequestUrl = pr.stdout.split("\n").find((line) => line.startsWith("http"));
    if (!run.pullRequestUrl) throw new Error("GitHub CLI did not return a pull request URL.");
    run.pullRequestState = "DRAFT";
    run.evidence.review = "Draft PR awaiting human review";
    run.state = "READY_FOR_HUMAN";
    run.status = "succeeded";
    addEvent(run, "Pull request", "SUCCEEDED", run.pullRequestUrl);
  } catch (error) {
    run.status = "failed";
    run.state = "FAILED";
    run.error = error instanceof CommandError
      ? error.result.stderr || error.result.stdout || error.message
      : error instanceof Error
        ? error.message
        : String(error);
    addEvent(run, "Workflow failed", "FAILED", run.error);
  }
}

export async function markPullRequestReady(run) {
  if (!run.pullRequestUrl) throw new Error("The run does not have a pull request.");
  await runCommand("gh", ["pr", "ready", run.pullRequestUrl], { cwd: DEMO_CONFIG.repositoryRoot });
  run.pullRequestState = "OPEN";
  run.evidence.review = "Ready for human review";
  addEvent(run, "Pull request ready", "SUCCEEDED", "Draft status removed on GitHub.");
}

export async function syncPullRequest(run) {
  if (!run.pullRequestUrl) throw new Error("The run does not have a pull request.");
  const result = await runCommand(
    "gh",
    ["pr", "view", run.pullRequestUrl, "--json", "state,isDraft,mergedAt,url"],
    { cwd: DEMO_CONFIG.repositoryRoot },
  );
  const pr = JSON.parse(result.stdout);
  const nextState = pr.mergedAt ? "MERGED" : pr.state === "CLOSED" ? "CLOSED" : pr.isDraft ? "DRAFT" : "OPEN";
  if (nextState !== run.pullRequestState) {
    addEvent(run, "Pull request synced", "SUCCEEDED", `GitHub reports ${nextState.toLowerCase()}.`);
  }
  run.pullRequestState = nextState;
  return run;
}
