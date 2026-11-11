// `rule-validator doctor` orchestration: context discovery, detectors, fix
// execution through mutate(), report emission, exit-code contract.
import path from "node:path";
import pc from "picocolors";
import packageJson from "../../package.json";
import { findProjectConfigPath, validateProjectConfig } from "../config.ts";
import { DETECTORS } from "./detectors.ts";
import {
	DOCTOR_CONTRACT_VERSION,
	DOCTOR_VERSION,
	DoctorExit,
	type ConfigState,
	type DetectorContext,
	type DetectorDescriptor,
	type DoctorAction,
	type DoctorFinding,
	type DoctorReport,
} from "./types.ts";
import { createRunContext, writeReport, type RunContext } from "./run-artifact.ts";
import { fixGitignoreDoctorDir } from "./fixers.ts";
import { acquireLock, releaseLock } from "./lock.ts";
import { MutateError } from "./mutate.ts";

export interface DoctorOptions {
	fix?: boolean;
	dryRun?: boolean;
	json?: boolean;
	robot?: boolean;
	quick?: boolean;
	/** Suppresses all report output (used by `health`, which prints its own one-liner). */
	silent?: boolean;
	/** Skip writing .doctor artifacts for this run (health path). */
	skipArtifactWrites?: boolean;
	/** Working directory override (defaults to process.cwd(); primarily for tests). */
	cwd?: string;
	only?: string;
	explain?: string;
	robotTriage?: boolean;
}

export async function runDoctorDiagnose(options: DoctorOptions): Promise<number> {
	const cwd = options.cwd ?? process.cwd();
	const { gitSha, repoRoot } = await discoverGit(cwd);
	const configState = await loadConfigState(cwd);
	const run = await createRunContext(cwd, gitSha, {
		skipRunDir: options.skipArtifactWrites === true || options.explain !== undefined,
	});
	const ctx = buildContext({ cwd, repoRoot, configState, run });
	const findings = await runDetectors(ctx, options);
	if (options.explain !== undefined) return printExplanation(findings, options.explain, options);
	const fixOutcome = await maybeApplyFixes({ run, ctx, options, findings });
	const finalFindings = fixOutcome.redetect ? await runDetectors(ctx, options) : findings;
	const report = buildReport({
		run,
		findings: finalFindings,
		actions: fixOutcome.actions,
		failure: fixOutcome.failure,
		repoRoot,
	});
	report.exit_code = computeExitCode(report, options, fixOutcome);
	if (!options.skipArtifactWrites) await writeReport(run, report);
	reportAndExit(report, options, fixOutcome);
	return report.exit_code;
}

async function discoverGit(
	cwd: string,
): Promise<{ gitSha: string | null; repoRoot: string | null }> {
	const gitSha = await gitOutput(["rev-parse", "HEAD"], cwd);
	const root = await gitOutput(["rev-parse", "--show-toplevel"], cwd);
	return { gitSha, repoRoot: root ? path.resolve(root) : null };
}

async function gitOutput(args: string[], cwd: string): Promise<string | null> {
	try {
		const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
		const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
		return code === 0 ? out.trim() || null : null;
	} catch {
		return null;
	}
}

interface ContextParts {
	cwd: string;
	repoRoot: string | null;
	configState: ConfigState;
	run: RunContext;
}

function buildContext(parts: ContextParts): DetectorContext {
	return {
		cwd: parts.cwd,
		repoRoot: parts.repoRoot,
		artifactPersistence: parts.run.artifactPersistence,
		configState: parts.configState,
	};
}

async function loadConfigState(cwd: string): Promise<ConfigState> {
	const configPath = await findProjectConfigPath(cwd);
	if (!configPath) return { kind: "absent" };
	return readAndValidateConfig(configPath);
}

async function readAndValidateConfig(configPath: string): Promise<ConfigState> {
	const raw = await Bun.file(configPath)
		.text()
		.catch(() => null);
	if (raw === null) return { kind: "malformed", configPath, error: "file unreadable" };
	const parsed = parseJsonSafe(raw);
	if (!parsed.ok) return { kind: "malformed", configPath, error: parsed.error };
	const result = validateProjectConfig(parsed.value);
	if (!result.ok) return { kind: "invalid", configPath, summary: result.summary };
	return { kind: "ok", config: result.config, configPath };
}

function parseJsonSafe(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
	try {
		return { ok: true, value: JSON.parse(raw) };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

async function runDetectors(
	ctx: DetectorContext,
	options: DoctorOptions,
): Promise<DoctorFinding[]> {
	const only = parseOnly(options.only);
	const selected = DETECTORS.filter((d) => detectorApplies(d, options, only));
	const nested = await Promise.all(
		selected.map((d) => d.detect(ctx).catch((error) => detectorCrash(d, error))),
	);
	return nested.flat();
}

function detectorApplies(
	d: DetectorDescriptor,
	options: DoctorOptions,
	only: Set<string> | null,
): boolean {
	if (only && !only.has(d.id)) return false;
	if (options.quick && !d.quick) return false;
	return true;
}

function parseOnly(only: string | undefined): Set<string> | null {
	if (!only) return null;
	const ids = only
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return ids.length > 0 ? new Set(ids) : null;
}

function detectorCrash(d: DetectorDescriptor, error: unknown): DoctorFinding[] {
	return [
		{
			id: d.id,
			severity: "error",
			title: `Detector ${d.id} crashed — treated as a finding, not a silent pass`,
			evidence: { error: error instanceof Error ? error.message : String(error) },
			remediation: { autoFixable: false, hint: "Report this with the detector id above." },
		},
	];
}

interface FixOutcome {
	actions: DoctorAction[];
	actionsPlanned: string[];
	failure?: string;
	dryRunNotice?: boolean;
	lockLost?: boolean;
	/** True when at least one fix ran — callers re-detect to see post-fix state. */
	redetect: boolean;
}

async function maybeApplyFixes(parts: {
	run: RunContext;
	ctx: DetectorContext;
	options: DoctorOptions;
	findings: DoctorFinding[];
}): Promise<FixOutcome> {
	const { run, ctx, options, findings } = parts;
	const fixable = findings.filter((f) => f.remediation.autoFixable);
	const outcome: FixOutcome = {
		actions: [],
		actionsPlanned: fixable.map((f) => f.id),
		redetect: false,
	};
	if (!options.fix || fixable.length === 0) return outcome;
	if (!run.artifactPersistence) {
		outcome.failure =
			"refusing to fix: .doctor/ artifacts cannot be persisted (no backup record possible)";
		return outcome;
	}
	if (options.dryRun) {
		outcome.dryRunNotice = true;
		return outcome;
	}
	return applyFixes({ run, ctx, fixable, outcome });
}

async function applyFixes(parts: {
	run: RunContext;
	ctx: DetectorContext;
	fixable: DoctorFinding[];
	outcome: FixOutcome;
}): Promise<FixOutcome> {
	const { run, ctx, fixable, outcome } = parts;
	if (!ctx.repoRoot) {
		outcome.failure = "refusing to fix: cwd is not inside a git repository";
		return outcome;
	}
	const lock = await acquireLock(run.doctorDir);
	if (!lock.ok) {
		outcome.failure = lock.holder?.startsWith("lock-error")
			? `cannot lock .doctor/: ${lock.holder}`
			: `another doctor holds .doctor/lock (${lock.holder})`;
		outcome.lockLost = !lock.holder?.startsWith("lock-error");
		return outcome;
	}
	try {
		for (const finding of fixable) {
			if (finding.id === "fm-io-gitignore-missing-doctor-dir")
				await applyGitignoreFix(run, ctx.repoRoot, outcome);
		}
		outcome.redetect = outcome.actions.length > 0;
		return outcome;
	} finally {
		await releaseLock(run.doctorDir);
	}
}

async function applyGitignoreFix(
	run: RunContext,
	repoRoot: string,
	outcome: FixOutcome,
): Promise<void> {
	try {
		const fix = await fixGitignoreDoctorDir(run, repoRoot);
		outcome.actions.push(...fix.actions);
	} catch (error) {
		outcome.failure =
			error instanceof MutateError
				? `refused: ${error.message}`
				: `fix failed: ${error instanceof Error ? error.message : String(error)}`;
	}
}

function buildReport(parts: {
	run: RunContext;
	findings: DoctorFinding[];
	actions: DoctorAction[];
	failure: string | undefined;
	repoRoot: string | null;
}): DoctorReport {
	const { run, findings, actions, failure, repoRoot } = parts;
	const summary = summarize(findings, actions);
	return {
		schema_version: DOCTOR_CONTRACT_VERSION,
		tool: "rule-validator",
		tool_version: packageJson.version,
		doctor_version: DOCTOR_VERSION,
		contract_version: DOCTOR_CONTRACT_VERSION,
		run_id: run.runId,
		started_at: run.startedAt,
		exit_code: 0,
		artifact_persistence: run.artifactPersistence,
		repo_root: repoRoot,
		findings,
		actions,
		summary: { ...summary, ...(failure ? { fix_failure: failure } : {}) },
	};
}

function summarize(findings: DoctorFinding[], actions: DoctorAction[]) {
	const count = (sev: string) => findings.filter((f) => f.severity === sev).length;
	return {
		errors: count("error"),
		warnings: count("warning"),
		infos: count("info"),
		actions_taken: actions.length,
	};
}

function reportAndExit(report: DoctorReport, options: DoctorOptions, fixOutcome: FixOutcome): void {
	if (options.silent) return;
	if (options.robotTriage) printTriage(report, fixOutcome);
	else if (options.json || options.robot) console.log(JSON.stringify(report));
	else printHuman(report, options, fixOutcome);
}

function computeExitCode(
	report: DoctorReport,
	options: DoctorOptions,
	fixOutcome: FixOutcome,
): number {
	if (options.fix && options.dryRun) return findingsExitCode(report.findings);
	if (options.fix && fixOutcome.lockLost) return DoctorExit.concurrencyLost;
	if (options.fix && fixOutcome.failure)
		return fixOutcome.actions.length > 0 ? DoctorExit.partial : DoctorExit.refused;
	return findingsExitCode(report.findings);
}

function findingsExitCode(findings: DoctorFinding[]): number {
	return findings.length === 0 ? DoctorExit.healthy : DoctorExit.findings;
}

function printTriage(report: DoctorReport, fixOutcome: FixOutcome): void {
	console.log(
		JSON.stringify({
			summary: report.summary,
			exit_code: report.exit_code,
			findings: report.findings,
			actions_planned: fixOutcome.actionsPlanned,
			recommended_command: recommendedCommand(report),
			capabilities_url: "rule-validator doctor capabilities --json",
		}),
	);
}

function recommendedCommand(report: DoctorReport): string {
	if (report.summary.actions_taken > 0)
		return "rule-validator doctor undo latest   # restore if the change is unwanted";
	if (report.findings.some((f) => f.remediation.autoFixable)) return "rule-validator doctor --fix";
	return "rule-validator doctor --explain <finding-id>";
}

function printHuman(report: DoctorReport, options: DoctorOptions, fixOutcome: FixOutcome): void {
	console.log(pc.dim("── rule-validator doctor ───────────────────────"));
	if (report.findings.length === 0) console.log(pc.green("✔ healthy — no findings"));
	for (const f of report.findings) printFinding(f);
	if (options.dryRun && fixOutcome.actionsPlanned.length > 0) {
		console.log(pc.cyan(`dry run — would fix: ${fixOutcome.actionsPlanned.join(", ")}`));
	}
	if (fixOutcome.failure) console.log(pc.red(`fix: ${fixOutcome.failure}`));
	if (report.summary.actions_taken > 0) {
		console.log(
			pc.green(
				`applied ${report.summary.actions_taken} action(s) — artifacts at .doctor/runs/${report.run_id}/`,
			),
		);
	}
}

function severityColor(severity: DoctorFinding["severity"]): (text: string) => string {
	if (severity === "error") return pc.red;
	if (severity === "warning") return pc.yellow;
	return pc.dim;
}

function printFinding(f: DoctorFinding): void {
	const color = severityColor(f.severity);
	console.log(`${color(`[${f.severity}]`)} ${f.id} — ${f.title}`);
	for (const [key, value] of Object.entries(f.evidence))
		console.log(`    ${pc.dim(`${key}:`)} ${value}`);
	console.log(pc.dim(`    → ${f.remediation.hint ?? f.remediation.command ?? "run --explain"}`));
}

function printExplanation(findings: DoctorFinding[], id: string, options: DoctorOptions): number {
	const match = findings.find((f) => f.id === id);
	if (!match) {
		console.error(`no finding with id "${id}" in this run (${findings.length} finding(s) total)`);
		return DoctorExit.noInput;
	}
	if (options.json || options.robot) console.log(JSON.stringify(match, null, 2));
	else printFinding(match);
	return DoctorExit.healthy;
}
