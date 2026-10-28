
import { spawn, type ChildProcess } from "node:child_process";

const NAMESPACE = process.env.K8S_NAMESPACE || "forgepods";
const LOCAL_PORT = 8080;
const STARTUP_TIMEOUT_MS = 10_000;

let activeProcess: ChildProcess | null = null;
let activeProjectId: string | null = null;
let startPromise: Promise<string> | null = null;

function stopActiveForward(): Promise<void> {
  const child = activeProcess;

  activeProcess = null;
  activeProjectId = null;
  startPromise = null;

  if (!child || child.exitCode !== null || child.killed) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill();

    setTimeout(() => resolve(), 2000);
  });
}

export async function openWorkspacePortForward(
  projectId: string,
  serviceName: string,
): Promise<string> {
  if (activeProjectId === projectId && activeProcess && activeProcess.exitCode === null) {
    return `http://localhost:${LOCAL_PORT}`;
  }

  if (startPromise && activeProjectId === projectId) {
    return startPromise;
  }

  await stopActiveForward();

  const promise = new Promise<string>((resolve, reject) => {
    const child = spawn(
      "kubectl",
      [
        "port-forward",
        "--address",
        "127.0.0.1",
        "-n",
        NAMESPACE,
        `service/${serviceName}`,
        `${LOCAL_PORT}:8080`,
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );

    activeProcess = child;
    activeProjectId = projectId;

    let settled = false;
    let output = "";

    const timeout = setTimeout(() => {
      fail(
        `Port-forward did not start within ${STARTUP_TIMEOUT_MS / 1000} seconds.`,
      );
    }, STARTUP_TIMEOUT_MS);

    function fail(message: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (activeProcess === child) {
        activeProcess = null;
        activeProjectId = null;
        startPromise = null;
      }

      child.kill();
      reject(new Error(`${message}${output ? ` Details: ${output.trim()}` : ""}`));
    }

    const handleOutput = (chunk: Buffer) => {
      output += chunk.toString();

      if (output.includes("Forwarding from 127.0.0.1:8080")) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(`http://localhost:${LOCAL_PORT}`);
      }

      if (
        output.includes("address already in use") ||
        output.includes("Only one usage of each socket address")
      ) {
        fail("Local port 8080 is already in use. Stop the existing port-forward and try again.");
      }
    };

    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);

    child.once("error", (error) => {
      fail(`Could not start kubectl: ${error.message}`);
    });

    child.once("exit", (code) => {
      if (!settled) {
        fail(`kubectl exited before forwarding started (code ${code}).`);
      } else if (activeProcess === child) {
        activeProcess = null;
        activeProjectId = null;
        startPromise = null;
      }
    });
  });

  startPromise = promise;
  return promise;
}
