import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DETECTORS, astRegistryIssues, regexRegistryIssues, runEngineSmoke } from "./detectors.ts";
import { runDoctorDiagnose } from "./doctor.ts";
import { runDoctorUndo } from "./commands.ts";
import type { DetectorContext } from "./types.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(path.join(os.tmpdir(), "rv-doctor-test-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function gitInit(target: string): void {
	Bun.spawnSync(["git", "init", "-q"], { cwd: target });
}

function write(file: string, content: string): void {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
}

function baseCtx(overrides: Partial<DetectorContext> = {}): DetectorContext {
	return {
		cwd: dir,
		repoRoot: dir,
		artifactPersistence: true,
		configState: { kind: "absent" },
		...overrides,
	};
}

describe("registry integrity", () => {
	it("reports no issues for the real registries", () => {
		expect(regexRegistryIssues([])).toEqual([]);
		expect(astRegistryIssues([])).toEqual([]);
	});

	it("detects duplicate names, empty messages and bad severities", () => {
		const rules = [
			{ name: "dup", pattern: /x/g, message: "one", severity: "error" as const },
			{ name: "dup", pattern: /y/g, message: "", severity: "bogus" as never },
		];
		const issues = regexRegistryIssues(rules);
		expect(issues.some((i) => i.includes('duplicate rule name "dup"'))).toBe(true);
		expect(issues.some((i) => i.includes("empty message"))).toBe(true);
		expect(issues.some((i) => i.includes("invalid severity"))).toBe(true);
	});

	it("detects non-function AST visitors", () => {
		const issues = astRegistryIssues([
			{ name: "broken", description: "x", severity: "error" as const, visit: 0 as never },
		]);
		expect(issues.some((i) => i.includes("visit is not a function"))).toBe(true);
	});
});

describe("AST engine smoke", () => {
	it("fires the expected rules on known-bad input", async () => {
		const { total } = await runEngineSmoke();
		expect(total).toBeGreaterThan(0);
	});

	it("fires nothing on an empty registry (failure path)", async () => {
		const { total } = await runEngineSmoke([]);
		expect(total).toBe(0);
	});
});

describe("unknown rule names", () => {
	const detector = DETECTORS.find((d) => d.id === "fm-configs-config-unknown-rule-name");

	it("suggests the closest registered rule for a typo", async () => {
		const ctx = baseCtx({
			configState: {
				kind: "ok",
				config: { rules: { "no-waitForTimeOut": { exclude: ["src/**"] } } },
				configPath: path.join(dir, "rule-validator.config.json"),
			},
		});
		const findings = await detector?.detect(ctx);
		expect(findings?.[0]?.evidence.suggestions).toContain("no-waitForTimeout");
	});

	it("stays silent when config rules are absent", async () => {
		const ctx = baseCtx({
			configState: {
				kind: "ok",
				config: { rules: {} },
				configPath: path.join(dir, "rule-validator.config.json"),
			},
		});
		expect(await detector?.detect(ctx)).toEqual([]);
	});
});

describe("end-to-end diagnose", () => {
	it("finds the missing .doctor/ ignore line in a fresh repo (exit 1)", async () => {
		gitInit(dir);
		expect(await runDoctorDiagnose({ cwd: dir, silent: true })).toBe(1);
	});

	it("passes once .gitignore lists .doctor/ (exit 0)", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), ".doctor/\n");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true })).toBe(0);
	});

	it("reports malformed JSON config as an error (exit 1)", async () => {
		gitInit(dir);
		write(path.join(dir, "rule-validator.config.json"), '{ "exclude": ["x",] }');
		expect(await runDoctorDiagnose({ cwd: dir, silent: true })).toBe(1);
	});

	it("reports schema-rejected config as an error (exit 1)", async () => {
		gitInit(dir);
		write(path.join(dir, "rule-validator.config.json"), '{ "rules": ["no-waitForTimeout"] }');
		expect(await runDoctorDiagnose({ cwd: dir, silent: true })).toBe(1);
	});

	it("--dry-run --fix prints the plan without mutating .gitignore", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		const code = await runDoctorDiagnose({ cwd: dir, silent: true, fix: true, dryRun: true });
		expect(code).toBe(1);
		expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe("node_modules\n");
	});

	it("--fix appends .doctor/ and a second --fix is a no-op", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe("node_modules\n.doctor/\n");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe("node_modules\n.doctor/\n");
	});

	it("undo latest restores .gitignore byte-identically", async () => {
		gitInit(dir);
		const original = "node_modules\ndist\n";
		write(path.join(dir, ".gitignore"), original);
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		expect(await runDoctorUndo("latest", dir)).toBe(0);
		expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe(original);
	});

	it("--explain exits 66 for an unknown finding id", async () => {
		gitInit(dir);
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, explain: "fm-does-not-exist" })).toBe(66);
	});

	it("refuses to fix while the lock is held (exit 5)", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		write(path.join(dir, ".doctor", "lock"), "pid=99999 started=2026-11-05T00:00:00Z\n");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(5);
		expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toBe("node_modules\n");
	});

	it("writes report.json artifacts into .doctor/runs/", async () => {
		gitInit(dir);
		expect(await runDoctorDiagnose({ cwd: dir, silent: true })).toBe(1);
		const runsDir = path.join(dir, ".doctor", "runs");
		const runs = await fs.readdir(runsDir);
		expect(runs.length).toBe(1);
		const reportRaw = await fs.readFile(path.join(runsDir, runs[0] as string, "report.json"), "utf8");
		const report = JSON.parse(reportRaw) as { exit_code: number; findings: Array<{ id: string }> };
		expect(report.exit_code).toBe(1);
		expect(report.findings.some((f) => f.id === "fm-io-gitignore-missing-doctor-dir")).toBe(true);
	});
});
