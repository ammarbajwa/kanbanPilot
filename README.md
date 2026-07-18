# MergeStamp

MergeStamp is a local-first, dark-mode Kanban application for turning structured
software tickets into tested, independently reviewed GitHub pull requests.

The current implementation includes one real vertical slice: a validated board
ticket can invoke GLM 5.2 through AkashML, create files through bounded tools,
validate them in an isolated Git worktree, commit, push, and open a draft pull
request with GitHub CLI. Run state is intentionally in memory for this demo;
persistence is not required.

## Run locally

1. Install dependencies and create the local environment file.

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. Add an AkashML API key to `.env.local` and authenticate GitHub CLI.

   ```bash
   gh auth login --hostname github.com
   gh auth status
   ```

3. Start the product and its loopback worker together.

   ```bash
   npm run dev:demo
   ```

4. Open the local URL printed by Vite, confirm every setup check is ready, then
   send MS-1 or a newly created ticket to the agent. The worker creates a unique
   `codex/mergestamp-ms-*` branch and a draft PR against `main`.

## Project shape

- `app/page.tsx` - focused daily Board at `/`
- `app/activity/page.tsx` - project-wide execution timeline at `/activity`
- `app/settings/page.tsx` - repository, runtime, and policy settings at `/settings`
- `app/mergestamp-provider.tsx` - shared ticket, workflow, and project state
- `app/mergestamp-shell.tsx` - persistent route navigation and worker status
- `app/mergestamp-domain.ts` - ticket, workflow, validation, and seed state
- `app/globals.css` - dark-mode operational interface styling
- `scripts/demo/server.mjs` - loopback HTTP boundary used by the product
- `scripts/demo/akash-agent.mjs` - AkashML GLM 5.2 tool loop and file policy
- `scripts/demo/workflow.mjs` - deterministic Git, validation, and GitHub flow
- `tests/rendered-html.test.mjs` - server-render and workflow-rule regression checks

## Real demo workflow

- The browser sends no API key and executes no repository commands.
- The worker calls AkashML's Anthropic-compatible Messages endpoint with the
  `zai-org--GLM-5.2` tool-use model alias.
- Akash receives only the selected ticket and no repository content. The LLM
  can write or delete only inside a unique `demo/runs/...` directory; every
  tool call is added to the ticket timeline.
- The local worker uses argument-array subprocesses for `git`, `node`, and `gh`.
  Ticket or model text is never interpolated into a shell command.
- Validation runs generated `.test.mjs` files with Node permissions that deny
  repository reads, network access, child processes, and inherited secrets,
  then checks the diff before commit and push.
- The worker opens a draft PR. MergeStamp can mark it ready and sync its live
  GitHub state; only a GitHub-confirmed merge moves the ticket to Done.
- Review feedback moves a ticket through `REVISION_QUEUED` and back to active
  work. The worker reads only the ticket's generated directory, applies the
  feedback, reruns validation, and pushes another commit to the same PR.

The demo worker binds only to `127.0.0.1:4317` and accepts product requests from
local development ports. This execution path is local-only: a hosted frontend cannot
access the repository, credentials, or GitHub CLI session on your machine.
