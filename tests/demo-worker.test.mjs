import assert from "node:assert/strict";
import test from "node:test";
import {
  createTicketPrompt,
  extractOutputText,
  validateRelativePath,
} from "../scripts/demo/akash-agent.mjs";
import { createRun, normalizeTicket } from "../scripts/demo/workflow.mjs";

const customTicket = {
  id: "ticket-2",
  sequenceNumber: 2,
  title: "Say hello to the team",
  description: "Create a small greeting app.",
  acceptanceCriteria: ["The output includes Hello, team!"],
};

test("allows demo writes and blocks paths outside the fixed scope", () => {
  assert.equal(
    validateRelativePath("demo/hello-world.mjs", { write: true }),
    "demo/hello-world.mjs",
  );
  assert.throws(
    () => validateRelativePath("app/page.tsx", { write: true }),
    /only write below demo/,
  );
  assert.equal(
    validateRelativePath("demo/runs/ms-2/file.mjs", {
      write: true,
      writableRoot: "demo/runs/ms-2",
    }),
    "demo/runs/ms-2/file.mjs",
  );
  assert.throws(
    () =>
      validateRelativePath("demo/runs/other/file.mjs", {
        write: true,
        writableRoot: "demo/runs/ms-2",
      }),
    /only write below demo\/runs\/ms-2/,
  );
  assert.throws(
    () => validateRelativePath("demo/../../.env.local", { write: true }),
    /escapes the repository|blocked by the demo policy/,
  );
  assert.throws(
    () => validateRelativePath("node_modules/pkg/index.js"),
    /blocked by the demo policy/,
  );
});

test("builds a scoped ticket prompt and extracts Akash message text", () => {
  const prompt = createTicketPrompt(
    customTicket,
    "demo/runs/ms-2-example",
    "A validation check failed.",
  );
  assert.match(prompt, /Say hello to the team/);
  assert.match(prompt, /demo\/runs\/ms-2-example/);
  assert.match(prompt, /\.test\.mjs/);
  assert.match(prompt, /Previous validation feedback/);
  assert.equal(
    extractOutputText({
      content: [{ type: "text", text: "Implemented and tested." }],
    }),
    "Implemented and tested.",
  );
});

test("creates unique draft-PR workflow runs on codex branches", () => {
  const first = createRun(customTicket);
  const second = createRun(customTicket);
  assert.match(first.branchName, /^codex\/mergestamp-ms-2-say-hello-to-the-team-/);
  assert.equal(first.ticketId, "ticket-2");
  assert.match(first.scope, /^demo\/runs\/ms-2-/);
  assert.equal(first.state, "QUEUED");
  assert.equal(first.evidence.tests, "Pending");
  assert.notEqual(first.id, second.id);
  assert.equal(first.model, "zai-org--GLM-5.2");
});

test("validates ticket payloads before they reach the LLM", () => {
  assert.deepEqual(normalizeTicket(customTicket), customTicket);
  assert.throws(
    () => normalizeTicket({ ...customTicket, acceptanceCriteria: [] }),
    /1-12 acceptance criteria/,
  );
  assert.throws(
    () => normalizeTicket({ ...customTicket, id: "../../escape" }),
    /Ticket id is invalid/,
  );
});
