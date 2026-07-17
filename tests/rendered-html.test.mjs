import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("server-renders the MergeStamp workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MergeStamp<\/title>/i);
  assert.match(html, /Local-first agentic development Kanban/);
  assert.match(html, /AI-assisted project intake/);
  assert.match(html, /Real end-to-end demo/);
  assert.match(html, /Run real workflow/);
  assert.match(html, /Local demo worker/);
  assert.match(html, /AkashML/);
  assert.match(html, /zai-org\/GLM-5\.2/);
  assert.match(html, /Ready for agent/);
  assert.match(html, /In progress/);
  assert.match(html, /Ready for review/);
  assert.match(html, /Evidence package/);
  assert.match(html, /https:\/\/github\.com\/ammarbajwa\/kanbanPilot/);
});

test("keeps workflow rules outside the React component", async () => {
  const [page, domain, css, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mergestamp-domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/demo/workflow.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /from "\.\/mergestamp-domain"/);
  assert.match(domain, /export function canTransition/);
  assert.match(domain, /export function validateReadyForAgent/);
  assert.match(domain, /TODO:\s*\["READY_FOR_AGENT"\]/);
  assert.match(domain, /READY_FOR_REVIEW:\s*\["READY_FOR_AGENT", "DONE"\]/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /--bg:\s*#101216/);
  assert.doesNotMatch(page, /const allowedTransitions/);
  assert.doesNotMatch(page, /completeWorkflowRun/);
  assert.match(worker, /git.*worktree/si);
  assert.match(worker, /"gh".*"pr".*"create"/si);
  assert.match(worker, /--untracked-files=all/);
});
