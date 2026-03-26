import { runDevCommand, type DevCommandFlags } from "./dev.js";

export type DevHttpsCommandFlags = Omit<DevCommandFlags, "open"> & {
  open?: boolean;
};

export async function runDevHttpsCommand(flags: DevHttpsCommandFlags): Promise<void> {
  console.log(
    "Warning: `teleforge dev:https` is a legacy alias. Prefer `teleforge dev --public --live`."
  );

  await runDevCommand({
    ...flags,
    https: true,
    mock: typeof flags.mock === "boolean" ? flags.mock : false,
    open: typeof flags.open === "boolean" ? flags.open : false,
    qr: typeof flags.qr === "boolean" ? flags.qr : true,
    tunnel: typeof flags.tunnel === "boolean" ? flags.tunnel : true,
    webhook: typeof flags.webhook === "boolean" ? flags.webhook : false
  });
}
