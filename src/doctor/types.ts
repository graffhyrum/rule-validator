// Shared types and the exit-code dictionary for `rule-validator doctor`.
export const DOCTOR_CONTRACT_VERSION = "1.0";
export const DOCTOR_VERSION = "1.0.0";

export const DoctorExit = {
	healthy: 0,
	findings: 1,
	partial: 2,
	rolledBack: 3,
	refused: 4,
	concurrencyLost: 5,
	onlineRequired: 6,
	usage: 64,
	noInput: 66,
	cannotCreate: 73,
	ioError: 74,
} as const;
export type DoctorExitCode = (typeof DoctorExit)[keyof typeof DoctorExit];

export type FindingSeverity = "error" | "warning" | "info";

export interface DoctorFinding {
	/** fm-<subsystem>-<symptom> — stable, content-derived. */
	id: string;
	severity: FindingSeverity;
	title: string;
	/** file:line, key names, error messages — never generic prose. */
	evidence: Record<string, string>;
	remediation: {
		autoFixable: boolean;
		/** Exact command that resolves the finding. */
		command?: string;
		hint?: string;
	};
}

export interface DetectorContext {
	/** Absolute cwd the doctor was invoked in. */
	readonly cwd: string;
	/** Resolved git repo root, or null outside a repo / when git is absent. */
	readonly repoRoot: string | null;
	/** False when `.doctor/` artifacts cannot be persisted this run. */
	readonly artifactPersistence: boolean;
	/** Precomputed config discovery/validation; detectors never re-read it. */
	readonly configState: ConfigState;
}

export type ConfigState =
	| { kind: "absent" }
	| { kind: "ok"; config: import("../config.ts").ProjectConfig; configPath: string }
	| { kind: "malformed"; configPath: string; error: string }
	| { kind: "invalid"; configPath: string; summary: string };

export interface DetectorDescriptor {
	readonly id: string;
	readonly description: string;
	/** True for detectors cheap enough for `--quick`. */
	readonly quick: boolean;
	readonly detect: (ctx: DetectorContext) => Promise<DoctorFinding[]>;
}

export interface DoctorAction {
	path: string;
	/** "create" | "append" — the only ops pass 1 supports. */
	op: string;
	beforeHash: string | null;
	afterHash: string;
	timestamp: string;
	existed: boolean;
}

export interface DoctorReport {
	schema_version: string;
	tool: "rule-validator";
	tool_version: string;
	doctor_version: string;
	contract_version: string;
	run_id: string;
	started_at: string;
	exit_code: number;
	artifact_persistence: boolean;
	repo_root: string | null;
	findings: DoctorFinding[];
	actions: DoctorAction[];
	summary: {
		errors: number;
		warnings: number;
		infos: number;
		actions_taken: number;
		/** Set when a fix was requested but could not be applied (kept inside summary for schema stability). */
		fix_failure?: string;
	};
}
