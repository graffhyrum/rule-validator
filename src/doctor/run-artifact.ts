// Run-artifact lifecycle: run dir creation, report/actions emission, `latest` symlink.
// Detect mode writes ONLY these artifacts; they never touch project state.
import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import type { DoctorReport } from "./types.ts";

export function newRunId(seed: string): string {
	const iso = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
	const digest = createHash("sha256").update(`${seed}:${iso}:${process.pid}:${randomBytes(8).toString("hex")}`).digest("hex").slice(0, 6);
	return `${iso}__${digest}`;
}

export interface RunContext {
	readonly runId: string;
	readonly startedAt: string;
	readonly doctorDir: string;
	readonly runDir: string;
	readonly backupsDir: string;
	readonly artifactPersistence: boolean;
}

/** Probe writability; never throws. Creates `.doctor/` when possible.
 *  When `skipRunDir` is set, probes but does not create the per-run directory
 *  (health path: no artifacts, detectors still see a healthy filesystem state). */
export async function createRunContext(cwd: string, gitSha: string | null, opts: { skipRunDir?: boolean } = {}): Promise<RunContext> {
	const runId = newRunId(gitSha ?? "nogit");
	const doctorDir = path.join(cwd, ".doctor");
	const runDir = path.join(doctorDir, "runs", runId);
	const startedAt = new Date().toISOString();
	if (opts.skipRunDir) {
		const writable = await isDirWritable(cwd) && (await isDirWritable(path.join(cwd, ".doctor"), { allowMissing: true }));
		const backupsDir = path.join(runDir, "backups");
		return { runId, startedAt, doctorDir, runDir, backupsDir, artifactPersistence: writable };
	}
	if (!(await probeWritable(doctorDir))) {
		return { runId, startedAt, doctorDir, runDir, backupsDir: path.join(runDir, "backups"), artifactPersistence: false };
	}
	const backupsDir = path.join(runDir, "backups");
	return { runId, startedAt, doctorDir, runDir, backupsDir, artifactPersistence: true };
}

async function probeWritable(doctorDir: string): Promise<boolean> {
	try {
		await fs.mkdir(doctorDir, { recursive: true });
		const probe = path.join(doctorDir, `.probe-${process.pid}`);
		await fs.writeFile(probe, "ok");
		await fs.unlink(probe);
		return true;
	} catch {
		return false;
	}
}

async function isDirWritable(dir: string, opts: { allowMissing?: boolean } = {}): Promise<boolean> {
	try {
		await fs.access(dir, fsConstants.W_OK);
		return true;
	} catch (error) {
		if (opts.allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return isDirWritable(path.dirname(dir));
		return false;
	}
}

export async function writeReport(run: RunContext, report: DoctorReport): Promise<void> {
	if (!run.artifactPersistence) return;
	const json = JSON.stringify(report, null, 2);
	await fs.mkdir(run.runDir, { recursive: true });
	await fs.writeFile(path.join(run.runDir, "report.json"), json);
	await fs.writeFile(path.join(run.runDir, "report.md"), renderReportMarkdown(report));
	await flipLatestSymlink(run);
}

export async function appendAction(run: RunContext, line: object): Promise<void> {
	if (!run.artifactPersistence) return;
	await fs.mkdir(run.runDir, { recursive: true });
	await fs.appendFile(path.join(run.runDir, "actions.jsonl"), `${JSON.stringify(line)}\n`);
}

async function flipLatestSymlink(run: RunContext): Promise<void> {
	const latest = path.join(run.doctorDir, "latest");
	const tmp = path.join(run.doctorDir, `.latest-tmp-${process.pid}`);
	try {
		await fs.unlink(tmp).catch(() => {});
		await fs.symlink(run.runDir, tmp);
		await fs.rename(tmp, latest);
	} catch {
		// Filesystems without symlinks: `doctor ls` still finds runs; not fatal.
	}
}

export function renderReportMarkdown(report: DoctorReport): string {
	const lines = [
		`# rule-validator doctor — run ${report.run_id}`,
		``,
		`- exit code: ${report.exit_code}`,
		`- findings: ${report.findings.length} (${report.summary.errors} error, ${report.summary.warnings} warning)`,
		`- actions taken: ${report.summary.actions_taken}`,
		``,
	];
	for (const f of report.findings) {
		lines.push(`- [${f.severity}] ${f.id} — ${f.title}`);
	}
	lines.push(``);
	return lines.join("\n");
}
