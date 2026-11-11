// Standalone `rule-validator doctor` command tree. Kept separate from the
// scan program: the parent must not also run when `doctor` is the first
// argument. `main()` routes here before scan dispatch.
import { Command, CommanderError } from "commander";
import { runDoctorDiagnose } from "./doctor.ts";
import { runCapabilities, runDoctorUndo, runHealth, runLs, runRobotDocs } from "./commands.ts";
import { DoctorExit } from "./types.ts";

export function buildDoctorProgram(): Command {
	const doctor = new Command("doctor");
	doctor.description(
		"Diagnose rule-validator itself (read-only); --fix applies reversible repairs",
	);
	doctor.option("--fix", "apply auto-fixable findings (verbatim backups first)");
	doctor.option("--dry-run", "print the repair plan; write nothing");
	doctor.option("--json", "emit the full report as JSON");
	doctor.option("--robot", "alias for --json");
	doctor.option("--quick", "only fast detectors (skips the AST in-memory smoke test)");
	doctor.option("--only <ids>", "comma-separated detector ids to run");
	doctor.option("--explain <finding-id>", "expand one finding with full evidence");
	doctor.option("--robot-triage", "one-call agent triage: summary, findings, recommended_command");
	doctor.option("--online", "reserved for future network probes; doctor runs fully offline");
	doctor.action(async (opts: Record<string, unknown>) => {
		if (opts.online)
			console.error(
				"--online: no network probes run this pass; flag accepted for contract stability",
			);
		process.exit(await runDoctorDiagnose(opts));
	});
	doctor
		.command("health")
		.description("one-line liveness check for CI; exit 0/1")
		.action(async () => {
			process.exit(await runHealth());
		});
	doctor
		.command("capabilities")
		.description("print the doctor contract (detectors, fixers, exit codes, paths written)")
		.option("--json", "compact single-line JSON")
		.action((o: { json?: boolean }) => {
			process.exit(runCapabilities(o.json));
		});
	doctor
		.command("robot-docs")
		.description("print a paste-ready agent handbook for this doctor")
		.action(() => {
			process.exit(runRobotDocs());
		});
	doctor
		.command("ls")
		.description("list past doctor runs in .doctor/runs/")
		.option("--json", "machine-readable output")
		.action(async (o: { json?: boolean }) => {
			process.exit(await runLs(o.json));
		});
	doctor
		.command("undo [run-id]")
		.description("restore a previous run's mutations from backups (default: latest)")
		.action(async (runId: string | undefined) => {
			process.exit(await runDoctorUndo(runId));
		});
	return doctor;
}

/** argv is the tail AFTER the literal `doctor` token (e.g. ["--json"], ["ls"]). */
export async function runDoctorCli(argv: string[]): Promise<void> {
	const program = buildDoctorProgram();
	program.exitOverride();
	for (const sub of program.commands) sub.exitOverride();
	try {
		await program.parseAsync(argv, { from: "user" });
		// parseAsync returns only if no action ran (e.g. bare `doctor help`) — default exit 0.
		process.exit(DoctorExit.healthy);
	} catch (error) {
		if (error instanceof CommanderError) {
			process.exit(error.exitCode === 0 ? DoctorExit.healthy : DoctorExit.usage);
		}
		throw error;
	}
}
