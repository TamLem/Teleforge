import { spawn } from "node:child_process";
import process from "node:process";

export async function openBrowser(url: string): Promise<void> {
  const { command, args } = resolveOpenCommand(url);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function resolveOpenCommand(url: string): { command: string; args: string[] } {
  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url]
    };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "start", "", url]
    };
  }

  return {
    command: "xdg-open",
    args: [url]
  };
}
