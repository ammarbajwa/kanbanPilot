import { createServer } from "node:http";
import { DEMO_CONFIG } from "./config.mjs";
import {
  createRun,
  executeWorkflow,
  getPreflight,
  markPullRequestReady,
  syncPullRequest,
} from "./workflow.mjs";

const runs = new Map();
let currentRunId = null;
const MAX_REQUEST_BYTES = 32_000;

function allowedOrigin(origin) {
  return !origin || /^http:\/\/(localhost|127\.0\.0\.1):3\d{3}$/.test(origin);
}

function send(response, status, body, origin) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": origin || "http://localhost:3000",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_REQUEST_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (!allowedOrigin(origin)) return send(response, 403, { error: "Origin is not allowed." });
  if (request.method === "OPTIONS") return send(response, 204, null, origin);

  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return send(response, 200, await getPreflight(), origin);
    }
    if (request.method === "GET" && url.pathname === "/runs/current") {
      return send(response, 200, currentRunId ? runs.get(currentRunId) : null, origin);
    }
    if (request.method === "GET" && url.pathname.startsWith("/runs/")) {
      const run = runs.get(url.pathname.split("/")[2]);
      return run ? send(response, 200, run, origin) : send(response, 404, { error: "Run not found." }, origin);
    }
    if (request.method === "POST" && url.pathname === "/runs") {
      const active = currentRunId ? runs.get(currentRunId) : null;
      if (active?.status === "queued" || active?.status === "running") {
        return send(response, 409, { error: "A demo run is already active.", run: active }, origin);
      }
      const preflight = await getPreflight();
      if (preflight.status !== "ready") {
        return send(response, 409, { error: "Preflight checks are blocked.", preflight }, origin);
      }
      const body = await readJson(request);
      const run = createRun(body.ticket);
      runs.set(run.id, run);
      currentRunId = run.id;
      void executeWorkflow(run);
      return send(response, 202, run, origin);
    }

    const actionMatch = url.pathname.match(/^\/runs\/([^/]+)\/actions\/(ready|sync)$/);
    if (request.method === "POST" && actionMatch) {
      const run = runs.get(actionMatch[1]);
      if (!run) return send(response, 404, { error: "Run not found." }, origin);
      if (actionMatch[2] === "ready") await markPullRequestReady(run);
      else await syncPullRequest(run);
      return send(response, 200, run, origin);
    }
    return send(response, 404, { error: "Not found." }, origin);
  } catch (error) {
    return send(
      response,
      500,
      { error: error instanceof Error ? error.message : String(error) },
      origin,
    );
  }
});

server.listen(DEMO_CONFIG.port, "127.0.0.1", () => {
  console.log(`MergeStamp demo worker listening on http://127.0.0.1:${DEMO_CONFIG.port}`);
});
