import process from "node:process";
import { runDoctorChecks } from "../utils/doctor/checks.js";
import { formatDoctorReport } from "../utils/doctor/formatters.js";

export interface DoctorCommandFlags {
  cwd: string;
  fix: boolean;
  json: boolean;
  verbose: boolean;
}

export async function runDoctorCommand(flags: DoctorCommandFlags): Promise<void> {
  const result = await runDoctorChecks({
    cwd: flags.cwd,
    fix: flags.fix
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatDoctorReport(result, { verbose: flags.verbose }));
  }

  if (result.status === "error") {
    process.exitCode = 1;
  }
}
