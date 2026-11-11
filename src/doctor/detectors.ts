// Detectors: pure readers that return findings. Never call mutate(), never write.
// Gate chain order is enforced by the orchestrator via ctx.configState.
import { promises as fs } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { glob } from "glob";
import { AST_RULES } from "../rules/all-rules.js";
import type { ASTRule } from "../rules/rule.js";
import { runRules } from "../rules/runner.js";
import { RULES } from "../rules.ts";
import type { Rule } from "../index.ts";
import { createAnalyzer } from "../typescript/compiler.js";
import type { DetectorContext, DetectorDescriptor, DoctorFinding } from "./types.ts";

export const DETECTORS: readonly DetectorDescriptor[] = [
	{
		id: "fm-io-doctor-dir-unwritable",
		description: ".doctor/ artifacts cannot be persisted — fixes refuse",
		quick: true,
		detect: detectDoctorDirUnwritable,
	},
	{
		id: "fm-runtime-not-bun",
		description: "CLI is not running under Bun",
		quick: true,
		detect: detectNotBun,
	},
	{
		id: "fm-rules-engine-regex-missing-g-flag",
		description: "A registered regex rule lacks the g flag (matchAll would crash)",
		quick: true,
		detect: detectRegexMissingGFlag,
	},
	{
		id: "fm-rules-engine-registry-integrity",
		description: "Registry invariants: unique names, valid severities, non-empty messages/visitors",
		quick: true,
		detect: detectRegistryIntegrity,
	},
	{
		id: "fm-rules-engine-ast-smoke-fails",
		description: "AST engine produces zero violations on a known-bad snippet",
		quick: false,
		detect: detectAstSmokeFails,
	},
	{
		id: "fm-rules-engine-parse-diagnostics",
		description: "TypeScript parseDiagnostics canary (AST under-report risk)",
		quick: false,
		detect: detectParseDiagnostics,
	},
	{
		id: "fm-configs-config-file-malformed-json",
		description: "rule-validator.config.json exists but is not valid JSON",
		quick: true,
		detect: detectConfigMalformed,
	},
	{
		id: "fm-configs-config-schema-reject",
		description: "Config JSON rejected by the arktype schema",
		quick: true,
		detect: detectConfigSchema,
	},
	{
		id: "fm-configs-config-unknown-rule-name",
		description: "Config `rules` keys match no registered rule (silent no-op)",
		quick: false,
		detect: detectUnknownRuleNames,
	},
	{
		id: "fm-configs-config-exclude-glob-no-match",
		description: "Top-level exclude glob matches zero files",
		quick: false,
		detect: detectExcludeGlobNoMatch,
	},
	{
		id: "fm-io-gitignore-missing-doctor-dir",
		description: "Repo does not ignore .doctor/ (run artifacts could be committed)",
		quick: true,
		detect: detectGitignoreMissingDoctor,
	},
];

async function detectDoctorDirUnwritable(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (ctx.artifactPersistence) return [];
	return [
		finding(
			"fm-io-doctor-dir-unwritable",
			"warning",
			".doctor/ is not writable — doctor runs read-only and --fix refuses",
			{
				cwd: ctx.cwd,
				error: "mkdir or probe write under .doctor/ failed",
			},
			{
				autoFixable: false,
				hint: "Fix permissions on the cwd or the .doctor/ entry, then re-run.",
			},
		),
	];
}

async function detectNotBun(): Promise<DoctorFinding[]> {
	if (process.versions.bun) return [];
	return [
		finding(
			"fm-runtime-not-bun",
			"error",
			"rule-validator must run under Bun",
			{
				runtime_node: process.version ?? "unknown",
			},
			{
				autoFixable: false,
				hint: "Run via the `rule-validator` bin under Bun (shebang #!/usr/bin/env bun).",
			},
		),
	];
}

async function detectRegexMissingGFlag(): Promise<DoctorFinding[]> {
	const bad = RULES.filter((rule) => !rule.pattern.global).map(ruleSummary);
	if (bad.length === 0) return [];
	return [
		finding(
			"fm-rules-engine-regex-missing-g-flag",
			"error",
			"Registered regex rule(s) lack the g flag — matchAll would crash the scan",
			{
				rules: bad.join(", "),
				fix: "src/rules.ts — add the g flag to these patterns",
			},
			{ autoFixable: false },
		),
	];
}

async function detectRegistryIntegrity(): Promise<DoctorFinding[]> {
	const issues = [...regexRegistryIssues(RULES), ...astRegistryIssues(AST_RULES)];
	if (issues.length === 0) return [];
	return [
		finding(
			"fm-rules-engine-registry-integrity",
			"error",
			"Rule registry invariant(s) violated",
			{
				issues: issues.join("; "),
			},
			{ autoFixable: false },
		),
	];
}

export function regexRegistryIssues(rules: readonly Rule[]): string[] {
	return [
		...duplicateNameIssues(
			rules.map((r) => r.name),
			"regex",
		),
		...rules.flatMap((r) => (r.message.trim() ? [] : [`regex rule ${r.name}: empty message`])),
		...rules.flatMap((r) =>
			r.severity === "error" || r.severity === "warning"
				? []
				: [`regex rule ${r.name}: invalid severity`],
		),
	];
}

export function astRegistryIssues(rules: readonly ASTRule[]): string[] {
	return [
		...duplicateNameIssues(
			rules.map((r) => r.name),
			"ast",
		),
		...rules.flatMap((r) =>
			r.description.trim() ? [] : [`ast rule ${r.name}: empty description`],
		),
		...rules.flatMap((r) =>
			typeof r.visit === "function" ? [] : [`ast rule ${r.name}: visit is not a function`],
		),
		...rules.flatMap((r) =>
			r.severity === "error" || r.severity === "warning"
				? []
				: [`ast rule ${r.name}: invalid severity`],
		),
	];
}

function duplicateNameIssues(names: readonly string[], kind: string): string[] {
	const counts = new Map<string, number>();
	for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
	return [...counts]
		.filter(([, n]) => n > 1)
		.map(([name]) => `${kind} registry: duplicate rule name "${name}"`);
}

export const SMOKE_SOURCE = "const x = y as unknown as string;\npage.waitForTimeout(100);\n";
const SMOKE_EXPECTED = ["no-unknown-as-cast", "no-waitForTimeout"] as const;

/** Exposed for tests so the failure path can inject a stub registry. */
export async function runEngineSmoke(
	rules: readonly ASTRule[] = AST_RULES,
): Promise<{ fired: string[]; total: number }> {
	const analyzer = await createAnalyzer(
		{ pattern: "doctor-smoke.ts", excludePatterns: [] },
		{ listFiles: async () => ["doctor-smoke.ts"], readFile: async () => SMOKE_SOURCE },
	);
	const results = runRules({ analyzer, rules: [...rules] });
	const fired = [...new Set(results.flatMap((r) => r.violations.map((v) => v.rule.name)))];
	const total = results.reduce((acc, r) => acc + r.violations.length, 0);
	return { fired, total };
}

async function detectAstSmokeFails(): Promise<DoctorFinding[]> {
	try {
		const { fired, total } = await runEngineSmoke();
		if (total > 0 && SMOKE_EXPECTED.some((name) => fired.includes(name))) return [];
		return [
			finding(
				"fm-rules-engine-ast-smoke-fails",
				"error",
				total === 0
					? "AST engine fired zero violations on known-bad input — the linter may be silently dead"
					: "AST engine ran but the expected smoke rules did not fire",
				{
					ts_version: ts.version,
					smoke_violations: String(total),
					fired: fired.join(",") || "(none)",
				},
				{
					autoFixable: false,
					hint: "Reinstall the toolchain: bun install --frozen-lockfile. If it persists, report with the output of `bun --version` and `ts.version`.",
				},
			),
		];
	} catch (error) {
		return [
			finding(
				"fm-rules-engine-ast-smoke-fails",
				"error",
				"AST engine threw during an in-memory smoke test",
				{
					ts_version: ts.version,
					error: error instanceof Error ? error.message : String(error),
				},
				{ autoFixable: false, hint: "Reinstall dependencies: bun install --frozen-lockfile." },
			),
		];
	}
}

async function detectParseDiagnostics(): Promise<DoctorFinding[]> {
	const probe = ts.createSourceFile(
		"doctor-probe.ts",
		"const x: = ;",
		ts.ScriptTarget.Latest,
		true,
	);
	const diagnostics = (probe as ts.SourceFile & { parseDiagnostics?: unknown }).parseDiagnostics;
	if (Array.isArray(diagnostics) && diagnostics.length > 0) return [];
	return [
		finding(
			"fm-rules-engine-parse-diagnostics",
			"warning",
			"TypeScript parse diagnostics are not visible to this install — AST under-reporting is undetectable",
			{
				ts_version: ts.version,
				parseDiagnostics:
					diagnostics === undefined ? "undefined (API moved?)" : String(diagnostics),
			},
			{ autoFixable: false, hint: "Check the typescript package mapping in package.json." },
		),
	];
}

async function detectConfigMalformed(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (ctx.configState.kind !== "malformed") return [];
	const { configPath, error } = ctx.configState;
	return [
		finding(
			"fm-configs-config-file-malformed-json",
			"error",
			"rule-validator.config.json is not valid JSON",
			{
				path: configPath,
				parse_error: error,
			},
			{
				autoFixable: false,
				hint: "Fix the JSON syntax by hand. doctor does not rewrite your config.",
			},
		),
	];
}

async function detectConfigSchema(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (ctx.configState.kind !== "invalid") return [];
	const { configPath, summary } = ctx.configState;
	return [
		finding(
			"fm-configs-config-schema-reject",
			"error",
			"rule-validator.config.json failed schema validation",
			{
				path: configPath,
				arkype_summary: truncate(summary, 300),
			},
			{
				autoFixable: false,
				hint: "Fix the offending key named in the summary (common causes: unknown top-level key, `exclude` not a string array, root is an array).",
			},
		),
	];
}

async function detectUnknownRuleNames(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (ctx.configState.kind !== "ok") return [];
	const keys = Object.keys(ctx.configState.config.rules ?? {});
	if (keys.length === 0) return [];
	const known = new Map<string, string>();
	for (const rule of RULES) known.set(rule.name.toLowerCase(), rule.name);
	for (const rule of AST_RULES) known.set(rule.name.toLowerCase(), rule.name);
	const unknown = keys.filter(
		(key) => !RULES.some((r) => r.name === key) && !AST_RULES.some((r) => r.name === key),
	);
	if (unknown.length === 0) return [];
	const suggestions = unknown.map(
		(key) => `${key} → did you mean ${closestKnown(key, known) ?? "(no close match)"}?`,
	);
	return [
		finding(
			"fm-configs-config-unknown-rule-name",
			"warning",
			`Config rules section names ${unknown.length} unknown rule(s) — those exclusions are inert`,
			{
				path: ctx.configState.configPath,
				unknown_rules: unknown.join(", "),
				suggestions: suggestions.join(" | "),
			},
			{
				autoFixable: false,
				hint: "Edit the config by hand. doctor never strips keys — your config may target a newer binary with more rules.",
			},
		),
	];
}

async function detectExcludeGlobNoMatch(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (ctx.configState.kind !== "ok") return [];
	const patterns = ctx.configState.config.exclude ?? [];
	const probes = patterns.filter((p) => !/[$]/.test(p));
	const misses: string[] = [];
	for (const pattern of probes) {
		const matches = await glob(pattern, { cwd: ctx.cwd, nodir: true }).catch(() => [] as string[]);
		if (matches.length === 0) misses.push(pattern);
	}
	if (misses.length === 0) return [];
	return [
		finding(
			"fm-configs-config-exclude-glob-no-match",
			"info",
			"Exclude glob(s) match zero files under the cwd — the exclusion is inert or the cwd differs",
			{
				path: ctx.configState.configPath,
				patterns_with_zero_matches: misses.join(", "),
			},
			{
				autoFixable: false,
				hint: "Check the glob spelling. Intentional in CI or monorepo configs — verify, don't delete.",
			},
		),
	];
}

async function detectGitignoreMissingDoctor(ctx: DetectorContext): Promise<DoctorFinding[]> {
	if (!ctx.repoRoot) return [];
	const gitignorePath = path.join(ctx.repoRoot, ".gitignore");
	if (await gitignoreHasDoctorEntry(gitignorePath)) return [];
	return [
		finding(
			"fm-io-gitignore-missing-doctor-dir",
			"warning",
			"Repo does not ignore .doctor/ — doctor run artifacts (with pre-edit file backups) could be committed",
			{
				path: gitignorePath,
				repo_root: ctx.repoRoot,
			},
			{
				autoFixable: true,
				command: "rule-validator doctor --fix --only fm-io-gitignore-missing-doctor-dir",
				hint: "Appends `.doctor/` to .gitignore (verbatim backup kept; undo restores byte-identically).",
			},
		),
	];
}

async function gitignoreHasDoctorEntry(gitignorePath: string): Promise<boolean> {
	const content = await fs.readFile(gitignorePath, "utf8").catch(() => null);
	if (content === null) return false;
	return content.split("\n").some((line) => {
		const t = line.trim();
		return t === ".doctor/" || t === ".doctor";
	});
}

// eslint-disable-next-line max-params
function finding(
	id: string,
	severity: DoctorFinding["severity"],
	title: string,
	evidence: Record<string, string>,
	remediation: DoctorFinding["remediation"],
): DoctorFinding {
	return { id, severity, title, evidence, remediation };
}

function ruleSummary(rule: Rule): string {
	return `${rule.name}(flags=${rule.pattern.flags || "(none)"})`;
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function closestKnown(key: string, known: Map<string, string>): string | null {
	let best: { name: string; distance: number } | null = null;
	for (const [lowered, name] of known) {
		const distance = levenshtein(key.toLowerCase(), lowered);
		if (distance <= 3 && (!best || distance < best.distance)) best = { name, distance };
	}
	return best?.name ?? null;
}

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const curr = new Array<number>(n + 1).fill(0);
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
			curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
		}
		prev = curr;
	}
	return prev[n] ?? 0;
}
