import os from "node:os";
import path from "node:path";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import {
  createDefaultProfile,
  createExportFile,
  parseExportFile,
  parseProfile,
  slugifyProfileName,
  type MockExportFile,
  type MockProfile
} from "./types.js";

export interface MockProfileStorage {
  exportToFile(profile: MockProfile, targetPath: string): Promise<MockExportFile>;
  getRootDir(): string;
  importFromFile(sourcePath: string): Promise<MockProfile>;
  listProfiles(): Promise<Array<{ fileName: string; name: string }>>;
  loadProfile(name: string): Promise<MockProfile>;
  removeProfile(name: string): Promise<void>;
  saveProfile(profile: MockProfile, explicitName?: string): Promise<{ fileName: string; name: string }>;
}

export async function createMockProfileStorage(
  rootDir = resolveTeleforgeHome()
): Promise<MockProfileStorage> {
  const profilesDir = path.join(rootDir, "profiles");
  await mkdir(profilesDir, { recursive: true });

  const defaultPath = path.join(profilesDir, "default.json");
  try {
    await readFile(defaultPath, "utf8");
  } catch {
    const defaultProfile = createDefaultProfile(process.env.BOT_TOKEN);
    await writeProfile(defaultPath, defaultProfile);
  }

  return {
    async exportToFile(profile, targetPath) {
      const payload = createExportFile(profile);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      return payload;
    },
    getRootDir() {
      return rootDir;
    },
    async importFromFile(sourcePath) {
      const raw = await readFile(sourcePath, "utf8");
      const payload = parseExportFile(JSON.parse(raw), process.env.BOT_TOKEN);
      return payload.profile;
    },
    async listProfiles() {
      const entries = await readdir(profilesDir);
      const names = entries.filter((entry) => entry.endsWith(".json")).sort();

      const profiles = await Promise.all(
        names.map(async (entry) => {
          const raw = await readFile(path.join(profilesDir, entry), "utf8");
          const profile = parseProfile(JSON.parse(raw), process.env.BOT_TOKEN);
          return {
            fileName: entry,
            name: profile.name
          };
        })
      );

      return profiles;
    },
    async loadProfile(name) {
      const raw = await readFile(resolveProfilePath(profilesDir, name), "utf8");
      return parseProfile(JSON.parse(raw), process.env.BOT_TOKEN);
    },
    async removeProfile(name) {
      await rm(resolveProfilePath(profilesDir, name), { force: true });
    },
    async saveProfile(profile, explicitName) {
      const name = explicitName?.trim() || profile.name;
      const fileName = `${slugifyProfileName(name)}.json`;
      const nextProfile = parseProfile(
        {
          ...profile,
          name
        },
        process.env.BOT_TOKEN
      );
      await writeProfile(path.join(profilesDir, fileName), nextProfile);
      return {
        fileName,
        name: nextProfile.name
      };
    }
  };
}

export function resolveTeleforgeHome(): string {
  return process.env.TELEFORGE_HOME || path.join(os.homedir(), ".teleforge");
}

function resolveProfilePath(profilesDir: string, name: string): string {
  const fileName = name.endsWith(".json") ? name : `${slugifyProfileName(name)}.json`;
  return path.join(profilesDir, fileName);
}

async function writeProfile(targetPath: string, profile: MockProfile): Promise<void> {
  await writeFile(targetPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}
