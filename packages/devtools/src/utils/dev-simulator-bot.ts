import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { createDefaultProfile, type MockProfile } from "./mock-server/types.js";

export interface SimulatorBotBridge {
  cleanup(): Promise<void>;
  getRuntimeState(): Promise<SimulatorBotRuntimeState | null>;
  sendCallbackData(data: string, profile: MockProfile): Promise<SimulatorBotResponse>;
  getCommands(): Promise<string[]>;
  sendCommand(text: string, profile: MockProfile): Promise<SimulatorBotResponse>;
  sendWebAppData(data: string, profile: MockProfile): Promise<SimulatorBotResponse>;
}

export interface SimulatorBotRuntimeState {
  sessions?: Array<{
    currentRoute?: string | null;
    currentStepId?: string;
    currentStepType?: string;
    flowId?: string;
    miniApp?: {
      pendingChatHandoff?: boolean;
      resumedStepId?: string | null;
    };
    stateKey?: string;
  }>;
  updatedAt?: string | null;
}

export interface SimulatorBotResponse {
  commands: string[];
  messages: CapturedTelegramMessage[];
  runtimeState?: SimulatorBotRuntimeState;
}

export interface CapturedTelegramMessage {
  options?: {
    reply_markup?: {
      inline_keyboard?: Array<
        Array<{
          callback_data?: string;
          text: string;
          url?: string;
          web_app?: {
            url: string;
          };
        }>
      >;
    };
    reply_to_message_id?: number;
  };
  text?: string;
}

interface WorkerResponseEnvelope {
  error?: string;
  id?: string;
  result?: SimulatorBotResponse;
}

type WorkerRequest =
  | {
      data: string;
      id: string;
      profile: MockProfile;
      type: "callback_data";
    }
  | {
      id: string;
      profile: MockProfile;
      text: string;
      type: "command";
    }
  | {
      id: string;
      profile: MockProfile;
      type: "status";
    }
  | {
      data: string;
      id: string;
      profile: MockProfile;
      type: "web_app_data";
    };

interface PendingRequest {
  reject: (error: Error) => void;
  resolve: (response: SimulatorBotResponse) => void;
}

export async function createSimulatorBotBridge(options: {
  appUrl: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<SimulatorBotBridge | null> {
  const entryPath = resolveBotRuntimeEntry(options.cwd);
  if (!entryPath) {
    return null;
  }
  const tsxImportPath = resolveTsxImport(options.cwd);
  if (!tsxImportPath) {
    throw new Error(
      "Simulator bot runtime requires `tsx`. Install project dependencies before using workspace chat execution."
    );
  }

  const workerPath = path.join(resolveCurrentBundleDirectory(), "simulator-bot-worker.js");
  const child = spawn(process.execPath, ["--import", tsxImportPath, workerPath], {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      TELEFORGE_SIMULATOR_APP_URL: toWorkerAppUrl(options.appUrl),
      TELEFORGE_SIMULATOR_BOT_ENTRY: entryPath
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stderr.pipe(process.stderr);

  const bridge = new WorkerBackedSimulatorBotBridge(child);
  await bridge.getCommands();
  return bridge;
}

function resolveCurrentBundleDirectory(): string {
  const originalPrepareStackTrace = Error.prepareStackTrace;

  try {
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack as unknown as NodeJS.CallSite[] | undefined;

    for (const frame of stack ?? []) {
      const fileName = frame.getFileName();
      if (typeof fileName !== "string" || fileName.length === 0) {
        continue;
      }

      if (fileName.startsWith("node:")) {
        continue;
      }

      if (fileName.startsWith("file://")) {
        return path.dirname(fileURLToPath(fileName));
      }

      return path.dirname(fileName);
    }
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }

  return process.cwd();
}

function toWorkerAppUrl(appUrl: string): string {
  try {
    return new URL(appUrl).toString();
  } catch {
    const normalizedPath = appUrl.startsWith("/") ? appUrl : `/${appUrl}`;
    return new URL(normalizedPath, "https://teleforge-simulator.local").toString();
  }
}

class WorkerBackedSimulatorBotBridge implements SimulatorBotBridge {
  private readonly child: ChildProcessWithoutNullStreams;

  private readonly pending = new Map<string, PendingRequest>();

  private readonly responses: readline.Interface;

  private runtimeState: SimulatorBotRuntimeState | null = null;

  private requestCounter = 0;

  constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    this.responses = readline.createInterface({
      input: child.stdout
    });

    this.responses.on("line", (line) => {
      this.handleWorkerResponse(line);
    });

    child.once("exit", (code, signal) => {
      const error = new Error(
        `Simulator bot worker exited unexpectedly (${signal ?? code ?? "unknown"}).`
      );
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.responses.close();
    });
  }

  async cleanup(): Promise<void> {
    this.responses.close();

    if (this.child.exitCode !== null || this.child.killed) {
      return;
    }

    this.child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, 5_000);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async getCommands(): Promise<string[]> {
    const response = this.captureRuntimeState(
      await this.request({
        id: this.createRequestId(),
        profile: createWorkerProfile(),
        type: "status"
      })
    );
    return response.commands;
  }

  async getRuntimeState(): Promise<SimulatorBotRuntimeState | null> {
    if (this.runtimeState) {
      return this.runtimeState;
    }

    this.captureRuntimeState(
      await this.request({
        id: this.createRequestId(),
        profile: createWorkerProfile(),
        type: "status"
      })
    );
    return this.runtimeState;
  }

  async sendCommand(text: string, profile: MockProfile): Promise<SimulatorBotResponse> {
    return this.captureRuntimeState(
      await this.request({
        id: this.createRequestId(),
        profile,
        text,
        type: "command"
      })
    );
  }

  async sendCallbackData(data: string, profile: MockProfile): Promise<SimulatorBotResponse> {
    return this.captureRuntimeState(
      await this.request({
        data,
        id: this.createRequestId(),
        profile,
        type: "callback_data"
      })
    );
  }

  async sendWebAppData(data: string, profile: MockProfile): Promise<SimulatorBotResponse> {
    return this.captureRuntimeState(
      await this.request({
        data,
        id: this.createRequestId(),
        profile,
        type: "web_app_data"
      })
    );
  }

  private captureRuntimeState(response: SimulatorBotResponse): SimulatorBotResponse {
    if (response.runtimeState) {
      this.runtimeState = response.runtimeState;
    }

    return response;
  }

  private createRequestId(): string {
    this.requestCounter += 1;
    return `request-${this.requestCounter}`;
  }

  private handleWorkerResponse(line: string): void {
    if (line.trim().length === 0) {
      return;
    }

    let envelope: WorkerResponseEnvelope;

    try {
      envelope = JSON.parse(line) as WorkerResponseEnvelope;
    } catch {
      return;
    }

    const id = envelope.id;
    if (!id) {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    this.pending.delete(id);

    if (typeof envelope.error === "string" && envelope.error.length > 0) {
      pending.reject(new Error(envelope.error));
      return;
    }

    if (!envelope.result) {
      pending.reject(new Error("Simulator bot worker returned an empty result."));
      return;
    }

    pending.resolve(envelope.result);
  }

  private request(payload: WorkerRequest): Promise<SimulatorBotResponse> {
    return new Promise<SimulatorBotResponse>((resolve, reject) => {
      this.pending.set(payload.id, { reject, resolve });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (error) {
          this.pending.delete(payload.id);
          reject(error);
        }
      });
    });
  }
}

function createWorkerProfile(): MockProfile {
  const profile = createDefaultProfile();
  return {
    ...profile,
    name: "Simulator",
    launchParams: {
      ...profile.launchParams,
      query_id: "simulator-query-id",
      start_param: "dev",
      startapp: "dev"
    },
    user: {
      ...profile.user,
      first_name: "Simulator",
      id: 1,
      username: "simulator_user"
    }
  };
}

function resolveBotRuntimeEntry(cwd: string): string | null {
  const candidates = [
    path.join(cwd, "apps", "bot", "src", "runtime.ts"),
    path.join(cwd, "apps", "bot", "src", "runtime.mts"),
    path.join(cwd, "apps", "bot", "src", "runtime.js"),
    path.join(cwd, "apps", "bot", "src", "runtime.mjs")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveTsxImport(cwd: string): string | null {
  const candidates = [
    path.join(cwd, "node_modules", "tsx", "dist", "loader.mjs"),
    path.join(cwd, "apps", "bot", "node_modules", "tsx", "dist", "loader.mjs"),
    path.join(cwd, "..", "node_modules", "tsx", "dist", "loader.mjs")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
