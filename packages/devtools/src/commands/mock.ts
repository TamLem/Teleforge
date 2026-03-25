import { findAvailablePort } from "../utils/ports.js";
import {
  createMockProfileStorage,
  resolveTeleforgeHome
} from "../utils/mock-server/storage.js";
import { startMockServer } from "../utils/mock-server/server.js";

export interface MockCommandFlags {
  exportPath?: string;
  headless: boolean;
  importPath?: string;
  port?: number;
  profileName?: string;
  saveProfileName?: string;
}

export async function runMockCommand(flags: MockCommandFlags): Promise<void> {
  const requestedPort = typeof flags.port === "number" && flags.port > 0 ? flags.port : 3456;
  const port = await findAvailablePort(requestedPort);
  const storage = await createMockProfileStorage(resolveTeleforgeHome());
  const server = await startMockServer({
    exportPath: flags.exportPath,
    headless: flags.headless,
    importPath: flags.importPath,
    port,
    profileName: flags.profileName,
    saveProfileName: flags.saveProfileName,
    storage
  });

  console.log(`✓ Teleforge mock server running on ${server.url}`);
  console.log(`✓ Profile storage ready at ${storage.getRootDir()}/profiles`);

  if (port !== requestedPort) {
    console.log(`✓ Port ${requestedPort} unavailable, using ${port} instead`);
  }

  if (!flags.headless) {
    console.log("✓ Web UI available at /");
  } else {
    console.log("✓ Headless API mode enabled");
  }

  if (flags.profileName) {
    console.log(`✓ Loaded profile: ${flags.profileName}`);
  }

  if (flags.importPath) {
    console.log(`✓ Imported profile from ${flags.importPath}`);
  }

  if (flags.exportPath) {
    console.log(`✓ Exported startup profile to ${flags.exportPath}`);
  }

  console.log("");
  console.log("Available endpoints:");
  console.log(`  GET  ${server.url}/api/mock/state`);
  console.log(`  GET  ${server.url}/api/mock/profiles`);
  console.log(`  GET  ${server.url}/api/mock/events/log`);

  await new Promise<void>((resolve, reject) => {
    const stop = async () => {
      await server.stop();
      resolve();
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    server.server.once("error", reject);
  });
}
