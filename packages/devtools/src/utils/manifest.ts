import {
  loadManifest as loadCoreManifest,
  type TeleforgeManifest as CoreTeleforgeManifest
} from "@teleforge/core";

export interface TeleforgeManifest extends Omit<CoreTeleforgeManifest, "runtime"> {
  runtime: Omit<CoreTeleforgeManifest["runtime"], "webFramework"> & {
    webFramework: "vite" | "nextjs";
  };
}

/**
 * Loads a Teleforge manifest from disk and narrows the runtime to the web frameworks supported by
 * `@teleforge/devtools`.
 */
export async function loadManifest(
  cwd: string
): Promise<{ manifest: TeleforgeManifest; manifestPath: string }> {
  const { manifest, manifestPath } = await loadCoreManifest(cwd);

  if (manifest.runtime.webFramework !== "vite" && manifest.runtime.webFramework !== "nextjs") {
    throw new Error(
      "Invalid teleforge.app.json: runtime.webFramework is not supported by @teleforge/devtools."
    );
  }

  return {
    manifest: {
      ...manifest,
      runtime: {
        ...manifest.runtime,
        webFramework: manifest.runtime.webFramework
      }
    },
    manifestPath
  };
}
