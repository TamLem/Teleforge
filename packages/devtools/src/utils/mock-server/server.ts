import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { type MockProfileStorage } from "./storage.js";
import {
  createDefaultProfile,
  createExportFile,
  mergeProfile,
  parseExportFile,
  type MockEventLogEntry,
  type MockProfile,
  type PartialMockProfile
} from "./types.js";
import { createMockUiHtml } from "./ui.js";

export interface StartMockServerOptions {
  exportPath?: string;
  headless: boolean;
  importPath?: string;
  port: number;
  profileName?: string;
  saveProfileName?: string;
  storage: MockProfileStorage;
}

export interface MockServerHandle {
  port: number;
  server: http.Server;
  stop(): Promise<void>;
  url: string;
}

export async function startMockServer(options: StartMockServerOptions): Promise<MockServerHandle> {
  let currentProfile = await resolveInitialProfile(options);
  const eventLog: MockEventLogEntry[] = [];

  if (options.saveProfileName) {
    const persisted = await options.storage.saveProfile(currentProfile, options.saveProfileName);
    currentProfile = {
      ...currentProfile,
      name: persisted.name
    };
  }

  if (options.exportPath) {
    await options.storage.exportToFile(currentProfile, path.resolve(options.exportPath));
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");

      if ((request.method === "GET" || request.method === "HEAD") && isUiRoute(url.pathname)) {
        if (options.headless) {
          sendJson(response, 404, { error: "Headless mode does not serve the Web UI." });
          return;
        }

        sendHtml(response, createMockUiHtml());
        return;
      }

      if (!url.pathname.startsWith("/api/mock")) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      const pathname = url.pathname.slice("/api/mock".length) || "/";
      const body = await readJsonBody(request);

      if (request.method === "GET" && pathname === "/state") {
        sendJson(response, 200, { eventLog, profile: currentProfile });
        return;
      }

      if (request.method === "POST" && pathname === "/state") {
        currentProfile = mergeProfile(
          currentProfile,
          body as PartialMockProfile,
          process.env.BOT_TOKEN
        );
        sendJson(response, 200, { eventLog, profile: currentProfile });
        return;
      }

      if (request.method === "GET" && pathname === "/profiles") {
        sendJson(response, 200, { profiles: await options.storage.listProfiles() });
        return;
      }

      if (request.method === "POST" && pathname === "/profiles") {
        const explicitName =
          isRecord(body) && typeof body.name === "string" ? body.name : undefined;
        const profileRef = await options.storage.saveProfile(currentProfile, explicitName);
        currentProfile = {
          ...currentProfile,
          name: profileRef.name
        };
        sendJson(response, 201, {
          profile: currentProfile,
          profileRef
        });
        return;
      }

      if (request.method === "GET" && pathname.startsWith("/profiles/")) {
        const profileName = decodeURIComponent(pathname.replace("/profiles/", ""));
        currentProfile = await options.storage.loadProfile(profileName);
        sendJson(response, 200, { profile: currentProfile });
        return;
      }

      if (request.method === "DELETE" && pathname.startsWith("/profiles/")) {
        const profileName = decodeURIComponent(pathname.replace("/profiles/", ""));
        await options.storage.removeProfile(profileName);
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && pathname === "/events/trigger") {
        const name = isRecord(body) && typeof body.name === "string" ? body.name : "mockEvent";
        const entry: MockEventLogEntry = {
          at: new Date().toISOString(),
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          payload: isRecord(body) ? body.payload : undefined
        };
        eventLog.unshift(entry);
        eventLog.splice(24);
        sendJson(response, 201, { event: entry, events: eventLog });
        return;
      }

      if (request.method === "GET" && pathname === "/events/log") {
        sendJson(response, 200, { events: eventLog });
        return;
      }

      if (request.method === "POST" && pathname === "/export") {
        const payload = createExportFile(currentProfile);
        const exportPath =
          isRecord(body) && typeof body.path === "string" && body.path.trim().length > 0
            ? body.path
            : undefined;

        if (exportPath) {
          await mkdir(path.dirname(exportPath), { recursive: true });
          await writeFile(exportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        }

        sendJson(response, 200, payload);
        return;
      }

      if (request.method === "POST" && pathname === "/import") {
        if (!isRecord(body)) {
          sendJson(response, 400, { error: "Import body must be an object." });
          return;
        }

        if (typeof body.path === "string" && body.path.trim().length > 0) {
          currentProfile = await options.storage.importFromFile(body.path);
        } else {
          currentProfile = parseExportFile(body.payload, process.env.BOT_TOKEN).profile;
        }

        sendJson(response, 200, { eventLog, profile: currentProfile });
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected mock server error"
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => resolve());
  });

  return {
    port: options.port,
    server,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    url: `http://127.0.0.1:${options.port}`
  };
}

async function resolveInitialProfile(options: StartMockServerOptions): Promise<MockProfile> {
  if (options.importPath) {
    const resolved = path.resolve(options.importPath);
    const raw = await readFile(resolved, "utf8");
    return parseExportFile(JSON.parse(raw), process.env.BOT_TOKEN).profile;
  }

  if (options.profileName) {
    return options.storage.loadProfile(options.profileName);
  }

  return createDefaultProfile(process.env.BOT_TOKEN);
}

function isUiRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/user" ||
    pathname === "/launch" ||
    pathname === "/events" ||
    pathname === "/export"
  );
}

function sendHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-length": Buffer.byteLength(html),
    "content-type": "text/html; charset=utf-8"
  });
  if (response.req?.method === "HEAD") {
    response.end();
    return;
  }
  response.end(html);
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(body);
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
