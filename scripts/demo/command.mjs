import { spawn } from "node:child_process";

const MAX_OUTPUT = 12_000;

export class CommandError extends Error {
  constructor(command, args, result) {
    super(`${command} ${args.join(" ")} failed with exit code ${result.code}.`);
    this.name = "CommandError";
    this.command = command;
    this.args = args;
    this.result = result;
  }
}

export function runCommand(
  command,
  args,
  { cwd, env = process.env, timeoutMs = 0 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs)
      : null;

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-MAX_OUTPUT);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_OUTPUT);
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      const result = {
        code: timedOut ? 124 : code ?? 1,
        stdout: stdout.trim(),
        stderr: timedOut
          ? `${stderr}\nCommand timed out after ${timeoutMs}ms.`.trim()
          : stderr.trim(),
      };
      if (result.code === 0) resolve(result);
      else reject(new CommandError(command, args, result));
    });
  });
}

export async function commandCheck(name, command, args, options) {
  try {
    const result = await runCommand(command, args, options);
    return { name, ok: true, detail: result.stdout || "Available" };
  } catch (error) {
    const detail =
      error instanceof CommandError
        ? error.result.stderr || error.result.stdout || error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return { name, ok: false, detail };
  }
}
