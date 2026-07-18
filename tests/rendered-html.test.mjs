import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the focused Board workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MergeStamp<\/title>/i);
  assert.match(html, /Primary navigation/);
  assert.match(html, />Board</);
  assert.match(html, />Activity</);
  assert.match(html, />Settings</);
  assert.match(html, /\+ New todo/);
  assert.match(html, /Kanban board/);
  assert.match(html, /Ready for agent/);
  assert.match(html, /In progress/);
  assert.match(html, /Ready for review/);
  assert.match(html, /https:\/\/github\.com\/ammarbajwa\/kanbanPilot/);
  assert.doesNotMatch(html, /Operating standards/);
  assert.doesNotMatch(html, /Setup checks/);
});

test("server-renders project-wide Activity separately", async () => {
  const response = await render("/activity");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Activity<\/h1>/);
  assert.match(html, /Project-wide history/);
  assert.match(html, /No activity yet/);
  assert.doesNotMatch(html, /Kanban board/);
  assert.doesNotMatch(html, /Operating standards/);
});

test("server-renders repository and runtime Settings separately", async () => {
  const response = await render("/settings");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Settings<\/h1>/);
  assert.match(html, /Setup checks/);
  assert.match(html, /Repository and commands/);
  assert.match(html, /AI-assisted configuration/);
  assert.match(html, /Operating standards/);
  assert.match(html, /AkashML/);
  assert.match(html, /zai-org\/GLM-5\.2/);
  assert.doesNotMatch(html, /Kanban board/);
});

test("keeps shared state and workflow rules outside route components", async () => {
  const [page, provider, domain, css, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mergestamp-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mergestamp-domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/demo/workflow.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /from "\.\/mergestamp-domain"/);
  assert.match(page, /useMergeStamp/);
  assert.match(provider, /MergeStampProvider/);
  assert.match(provider, /applyServerRun/);
  assert.match(provider, /startWorkflow/);
  assert.match(provider, /requestRevision/);
  assert.match(domain, /export function canTransition/);
  assert.match(domain, /export function boardColumnForStatus/);
  assert.match(domain, /export function validateReadyForAgent/);
  assert.match(domain, /TODO:\s*\["READY_FOR_AGENT"\]/);
  assert.match(domain, /READY_FOR_REVIEW:\s*\["REVISION_QUEUED", "DONE"\]/);
  assert.match(domain, /REVISION_QUEUED:\s*\["IN_PROGRESS"\]/);
  assert.match(provider, /"REVISION_QUEUED"/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /--bg:\s*#101216/);
  assert.doesNotMatch(page, /const allowedTransitions/);
  assert.doesNotMatch(page, /demoWorkerUrl/);
  assert.match(worker, /git.*worktree/si);
  assert.match(worker, /"gh".*"pr".*"create"/si);
  assert.match(worker, /--untracked-files=all/);
});
