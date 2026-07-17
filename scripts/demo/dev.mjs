import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "demo:worker"], { stdio: "inherit", shell: false }),
  spawn("npm", ["run", "dev"], { stdio: "inherit", shell: false }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
