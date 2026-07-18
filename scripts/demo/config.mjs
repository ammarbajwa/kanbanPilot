export const DEMO_TICKET = {
  id: "ticket-demo",
  sequenceNumber: 1,
  title: "Add a tested hello-world module",
  description:
    "Create a tiny dependency-free JavaScript module that proves MergeStamp can turn a ticket into a validated GitHub pull request.",
  acceptanceCriteria: [
    "The implementation exports greeting(name), returning Hello, {name}!.",
    "Calling greeting without a name returns Hello, MergeStamp!.",
    "Running the module prints Hello, MergeStamp!.",
    "A node:test suite covers the named and default greeting cases.",
  ],
};

export const DEMO_CONFIG = {
  repositoryRoot: process.cwd(),
  repository: "ammarbajwa/kanbanPilot",
  baseBranch: "main",
  provider: "AkashML",
  akashApiBase: process.env.AKASHML_API_BASE || "https://api.akashml.com",
  model: process.env.AKASHML_MODEL || "zai-org--GLM-5.2",
  port: Number(process.env.MERGESTAMP_DEMO_PORT || 4317),
  maxToolRounds: 12,
  maxChangedFiles: 3,
  maxRevisionCycles: 3,
  writableRoots: ["demo"],
  forbiddenSegments: [
    ".env",
    ".git",
    ".wrangler",
    "node_modules",
    "package-lock.json",
  ],
};
