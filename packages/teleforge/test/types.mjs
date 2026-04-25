import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("TeleforgeMiniApp accepts screens with concrete state types", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "teleforge-types-"));
  const nodeModulesPath = path.join(tmpRoot, "node_modules");
  const webImportPath = path
    .relative(tmpRoot, path.join(packageRoot, "dist", "web.js"))
    .replaceAll(path.sep, "/");

  await mkdir(nodeModulesPath, { recursive: true });
  await symlink(
    path.join(packageRoot, "node_modules", "@types"),
    path.join(nodeModulesPath, "@types")
  );
  await symlink(
    path.join(packageRoot, "node_modules", "react"),
    path.join(nodeModulesPath, "react")
  );

  await writeFile(
    path.join(tmpRoot, "typed-screens.tsx"),
    `import { TeleforgeMiniApp, defineScreen } from ${JSON.stringify(`./${webImportPath}`)};

interface StartFlowState {
  phone: string;
}

const homeScreen = defineScreen<StartFlowState>({
  id: "home",
  component(props) {
    props.state.phone;
    return null;
  }
});

export const app = <TeleforgeMiniApp screens={[homeScreen]} />;
`
  );

  await writeFile(
    path.join(tmpRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          skipLibCheck: true,
          strict: true,
          target: "ES2022"
        },
        include: ["typed-screens.tsx"]
      },
      null,
      2
    )
  );

  const { stderr, stdout } = await execFileAsync(
    path.join(packageRoot, "node_modules", ".bin", "tsc"),
    ["-p", path.join(tmpRoot, "tsconfig.json"), "--noEmit"],
    {
      cwd: tmpRoot
    }
  );

  assert.equal(`${stdout}${stderr}`, "");
});
