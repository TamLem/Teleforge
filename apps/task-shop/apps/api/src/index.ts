import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { createDiscoveredServerHooksHandler } from "teleforge";
import type { DiscoveredBotRuntime, UserFlowStateManager } from "teleforge";

export interface StartHooksServerOptions {
  cwd: string;
  onChatHandoff: DiscoveredBotRuntime["handleChatHandoff"];
  storage: UserFlowStateManager;
  port?: number;
}

export async function startHooksServer(options: StartHooksServerOptions): Promise<void> {
  const hooksHandler = await createDiscoveredServerHooksHandler({
    cwd: options.cwd,
    onChatHandoff: options.onChatHandoff,
    storage: options.storage
  });

  const hooksPath = "/api/teleforge/flow-hooks";
  const port = options.port ?? 3100;

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url?.startsWith(hooksPath)) {
      console.log(`[task-shop:api] ${req.method} ${req.url}`);
      const body = await readRequestBody(req);
      console.log(`[task-shop:api] request body:`, body);
      const request = new Request(`http://localhost:${port}${req.url}`, {
        body,
        headers: { "content-type": req.headers["content-type"] ?? "application/json" },
        method: "POST"
      });
      const response = await hooksHandler(request);
      if (response) {
        console.log(`[task-shop:api] response ${response.status}`);
        const headers = { ...Object.fromEntries(response.headers.entries()), ...corsHeaders };
        res.writeHead(response.status, headers);
        res.end(await response.text());
      } else {
        console.log(`[task-shop:api] no response from handler`);
        res.writeHead(404, corsHeaders);
        res.end("Not found");
      }
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end("Not found");
  });

  server.listen(port, () => {
    console.log(`[task-shop:api] hooks server listening on port ${port}`);
  });
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
