import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { capabilitiesJson, ROBOT_DOCS } from "./capabilities.ts";
import { buildDoctorProgram, runDoctorCli } from "./cli.ts";
import { runCapabilities, runHealth, runLs, runRobotDocs, runDoctorUndo } from "./commands.ts";
import { runDoctorDiagnose } from "./doctor.ts";
import { acquireLock, releaseLock } from "./lock.ts";
import { mutate, MutateError } from "./mutate.ts";
import { undoRun, listRuns } from "./undo.ts";
import { createRunContext, writeReport } from "./run-artifact.ts";
import { resolveInside } from "./fs-utils.ts";
import type { DoctorReport } from "./types.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(path.join(os.tmpdir(), "rv-doctor-internals-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	mock.restore();
});

function gitInit(target: string): void {
	Bun.spawnSync(["git", "init", "-q"], { cwd: target });
}

function write(file: string, content: string): void {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
}

function fakeReport(runId: string, exitCode = 0): DoctorReport {
	return {
		schema_version: "1.0",
		tool: "rule-validator",
		tool_version: "1.2.0",
		doctor_version: "1.0.0",
		contract_version: "1.0",
		run_id: runId,
		started_at: "2026-11-05T00:00:00.000Z",
		exit_code: exitCode,
		artifact_persistence: true,
		repo_root: dir,
		findings: [],
		actions: [],
		summary: { errors: 0, warnings: 0, infos: 0, actions_taken: 0 },
	};
}

describe("capabilities + robot-docs", () => {
	it("capabilitiesJson carries the contract fields", () => {
		const caps = capabilitiesJson() as Record<string, unknown>;
		expect(caps.contract_version).toBe("1.0");
		expect(caps.offline).toBe(true);
		expect(Array.isArray(caps.detectors)).toBe(true);
		expect(ROBOT_DOCS).toContain("capabilities --json");
	});

	it("runCapabilities prints JSON both compact and pretty", () => {
		const log = spyOn(console, "log");
		expect(runCapabilities(true)).toBe(0);
		expect(runCapabilities(undefined)).toBe(0);
		expect(log.mock.calls[0]?.[0]).toContain('"schema_version"');
		expect(log.mock.calls[1]?.[0]).toContain("\n");
	});

	it("runRobotDocs prints the handbook", () => {
		const log = spyOn(console, "log");
		expect(runRobotDocs()).toBe(0);
		expect(log.mock.calls[0]?.[0]).toBe(ROBOT_DOCS);
	});
});

describe("standalone doctor command tree", () => {
	it("exposes the expected subcommands", () => {
		const names = buildDoctorProgram().commands.map((c) => c.name());
		expect(names).toContain("health");
		expect(names).toContain("capabilities");
		expect(names).toContain("robot-docs");
		expect(names).toContain("ls");
		expect(names).toContain("undo");
	});

	it("health exits through the action path", async () => {
		gitInit(dir);
		spyOn(console, "log");
		const cwd = process.cwd();
		process.chdir(dir);
		try {
			spyOn(process, "exit").mockImplementation(((code?: number): never => {
				throw new Error(`exit:${code}`);
			}) as (code?: number) => never);
			await expect(runDoctorCli(["health"])).rejects.toThrow("exit:1");
		} finally {
			process.chdir(cwd);
		}
	});

	it("ls exits through the action path", async () => {
		spyOn(console, "log");
		const cwd = process.cwd();
		process.chdir(dir);
		try {
			spyOn(process, "exit").mockImplementation(((code?: number): never => {
				throw new Error(`exit:${code}`);
			}) as (code?: number) => never);
			await expect(runDoctorCli(["ls"])).rejects.toThrow("exit:0");
		} finally {
			process.chdir(cwd);
		}
	});

	it("robot-docs exits through the action path", async () => {
		spyOn(console, "log");
		spyOn(process, "exit").mockImplementation(((code?: number): never => {
			throw new Error(`exit:${code}`);
		}) as (code?: number) => never);
		await expect(runDoctorCli(["robot-docs"])).rejects.toThrow("exit:0");
	});

	it("undo exits through the action path", async () => {
		spyOn(console, "error");
		const cwd = process.cwd();
		process.chdir(dir);
		try {
			spyOn(process, "exit").mockImplementation(((code?: number): never => {
				throw new Error(`exit:${code}`);
			}) as (code?: number) => never);
			await expect(runDoctorCli(["undo"])).rejects.toThrow("exit:66");
		} finally {
			process.chdir(cwd);
		}
	});

	it("bare doctor invocation exits through the default action", async () => {
		gitInit(dir);
		spyOn(console, "log");
		const cwd = process.cwd();
		process.chdir(dir);
		try {
			spyOn(process, "exit").mockImplementation(((code?: number): never => {
				throw new Error(`exit:${code}`);
			}) as (code?: number) => never);
			await expect(runDoctorCli([])).rejects.toThrow("exit:1");
		} finally {
			process.chdir(cwd);
		}
	});

	it("runDoctorCli(['capabilities']) exits 0 through the action path", async () => {
		const exit = spyOn(process, "exit").mockImplementation(((code?: number): never => {
			throw new Error(`exit:${code}`);
		}) as (code?: number) => never);
		await expect(runDoctorCli(["capabilities"])).rejects.toThrow("exit:0");
		expect(exit).toHaveBeenCalled();
	});

	it("runDoctorCli maps commander usage errors to exit 64", async () => {
		spyOn(process, "exit").mockImplementation(((code?: number): never => {
			throw new Error(`exit:${code}`);
		}) as (code?: number) => never);
		await expect(runDoctorCli(["--definitely-bad-flag"])).rejects.toThrow("exit:64");
	});
});

describe("health", () => {
	it("exits 1 in a fresh repo and leaves no .doctor behind", async () => {
		gitInit(dir);
		expect(await runHealth(dir)).toBe(1);
		expect(existsSync(path.join(dir, ".doctor"))).toBe(false);
	});

	it("exits 0 when the repo ignores .doctor/", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), ".doctor/\n");
		expect(await runHealth(dir)).toBe(0);
	});
});

describe("ls", () => {
	it("reports empty history in a repo without runs", async () => {
		const log = spyOn(console, "log");
		expect(await runLs(undefined, dir)).toBe(0);
		expect(log.mock.calls[0]?.[0]).toContain("no doctor runs");
	});

	it("lists runs and emits machine-readable output", async () => {
		const runDir = path.join(dir, ".doctor", "runs", "20261105T000000Z__abc123");
		write(path.join(runDir, "report.json"), JSON.stringify(fakeReport("20261105T000000Z__abc123", 1)));
		const log = spyOn(console, "log");
		expect(await runLs(undefined, dir)).toBe(0);
		expect(log.mock.calls[0]?.[0]).toContain("20261105T000000Z__abc123");
		expect(await runLs(true, dir)).toBe(0);
	});
});

describe("undo paths", () => {
	it("exits 66 when no runs exist", async () => {
		spyOn(console, "error");
		expect(await runDoctorUndo("latest", dir)).toBe(66);
	});

	it("exits 66 for an unknown run id", async () => {
		spyOn(console, "error");
		expect(await runDoctorUndo("20260101T000000Z__ffffff", dir)).toBe(66);
	});

	it("skips unreadable actions.jsonl lines and restores the valid one", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		const log = spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		const runsDir = path.join(dir, ".doctor", "runs");
		const [runId] = await fs.readdir(runsDir);
		const actionsPath = path.join(runsDir, runId as string, "actions.jsonl");
		writeFileSync(actionsPath, `garbage{\n${readFileSync(actionsPath, "utf8")}`);
		expect(await runDoctorUndo("latest", dir)).toBe(0);
		expect(log.mock.calls.flat().join(" ")).toContain("unreadable");
	});

	it("refuses to restore when the backup was corrupted (exit 3)", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		spyOn(console, "error");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		const run = await readLatestRun(dir);
		write(path.join(run, "backups", ".gitignore"), "tampered\n");
		expect(await runDoctorUndo("latest", dir)).toBe(3);
	});

	it("refuses to restore when the backup is missing (exit 3)", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		spyOn(console, "error");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		const run = await readLatestRun(dir);
		rmSync(path.join(run, "backups", ".gitignore"));
		expect(await runDoctorUndo("latest", dir)).toBe(3);
	});

	it("quarantines a file created by the fix instead of deleting it", async () => {
		gitInit(dir);
		spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		expect(existsSync(path.join(dir, ".gitignore"))).toBe(true);
		expect(await runDoctorUndo("latest", dir)).toBe(0);
		expect(existsSync(path.join(dir, ".gitignore"))).toBe(false);
		expect(existsSync(path.join(dir, ".doctor", "quarantine", ".gitignore"))).toBe(true);
	});

	it("refuses to quarantine a created file whose content changed (exit 3)", async () => {
		gitInit(dir);
		spyOn(console, "error");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		writeFileSync(path.join(dir, ".gitignore"), "user edited this\n");
		expect(await runDoctorUndo("latest", dir)).toBe(3);
	});

	it("listRuns returns empty for a missing runs directory", async () => {
		expect(await listRuns(path.join(dir, ".doctor"))).toEqual([]);
	});

	it("listRuns tolerates a corrupt report.json row", async () => {
		write(path.join(dir, ".doctor", "runs", "20261105T000002Z__bad000", "report.json"), "not json{\n");
		const runs = await listRuns(path.join(dir, ".doctor"));
		expect(runs).toHaveLength(1);
		expect(runs[0]?.run_id).toBe("20261105T000002Z__bad000");
		expect(runs[0]?.exit_code).toBeNull();
	});

	it("listRuns sorts multiple runs newest first", async () => {
		write(path.join(dir, ".doctor", "runs", "20261105T000001Z__aaa111", "report.json"), JSON.stringify(fakeReport("20261105T000001Z__aaa111", 0)));
		write(path.join(dir, ".doctor", "runs", "20261105T000002Z__bbb222", "report.json"), JSON.stringify(fakeReport("20261105T000002Z__bbb222", 1)));
		const runs = await listRuns(path.join(dir, ".doctor"));
		expect(runs.map((r) => r.run_id)).toEqual(["20261105T000002Z__bbb222", "20261105T000001Z__aaa111"]);
	});

	it("undo skips a created file that is already gone", async () => {
		gitInit(dir);
		spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		rmSync(path.join(dir, ".gitignore"));
		expect(await runDoctorUndo("latest", dir)).toBe(0);
	});

	it("undo refuses when actions.jsonl records no backup for an existed file", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		spyOn(console, "error");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(0);
		const run = await readLatestRun(dir);
		const actionsPath = path.join(run, "actions.jsonl");
		const line = JSON.parse(readFileSync(actionsPath, "utf8").trim()) as Record<string, unknown>;
		delete line.backup;
		writeFileSync(actionsPath, `${JSON.stringify(line)}\n`);
		expect(await runDoctorUndo("latest", dir)).toBe(3);
	});
});

async function readLatestRun(dirPath: string): Promise<string> {
	const runs = await listRuns(path.join(dirPath, ".doctor"));
	const first = runs[0];
	if (!first) throw new Error("expected at least one run");
	return path.join(dirPath, ".doctor", "runs", first.run_id);
}

describe("lock", () => {
	it("reclaims a stale lock and releases cleanly", async () => {
		const doctorDir = path.join(dir, ".doctor");
		mkdirSync(doctorDir, { recursive: true });
		const lockPath = path.join(doctorDir, "lock");
		writeFileSync(lockPath, "pid=1 started=old\n");
		const old = new Date(Date.now() - 60 * 60 * 1000);
		utimesSync(lockPath, old, old);
		const result = await acquireLock(doctorDir);
		expect(result.ok).toBe(true);
		await releaseLock(doctorDir);
		expect(existsSync(lockPath)).toBe(false);
	});

	it("refuses while a fresh lock is held", async () => {
		const doctorDir = path.join(dir, ".doctor");
		mkdirSync(doctorDir, { recursive: true });
		writeFileSync(path.join(doctorDir, "lock"), "pid=1 fresh\n");
		const result = await acquireLock(doctorDir);
		expect(result.ok).toBe(false);
		expect(result.holder).toContain("pid=1");
	});

	it("reports a lock error when .doctor is a regular file", async () => {
		writeFileSync(path.join(dir, ".doctor"), "not a directory\n");
		const result = await acquireLock(path.join(dir, ".doctor"));
		expect(result.ok).toBe(false);
		expect(result.holder).toContain("lock-error");
	});

	it("releaseLock is a no-op when the lock is absent", async () => {
		await releaseLock(path.join(dir, ".doctor-missing"));
	});

	it("reports lock-unreadable for a dangling symlink at the lock path", async () => {
		const doctorDir = path.join(dir, ".doctor");
		mkdirSync(doctorDir, { recursive: true });
		Bun.spawnSync(["ln", "-s", path.join(dir, "nonexistent-target"), path.join(doctorDir, "lock")]);
		const result = await acquireLock(doctorDir);
		expect(result.ok).toBe(false);
		expect(result.holder).toBe("lock-unreadable");
	});

	it("reports a fresh directory hold without recursing", async () => {
		const doctorDir = path.join(dir, ".doctor");
		mkdirSync(path.join(doctorDir, "lock"), { recursive: true });
		const result = await acquireLock(doctorDir);
		expect(result.ok).toBe(false);
		expect(result.holder).toBe("unknown");
	});

	it("refuses an unremovable stale directory lock instead of recursing forever", async () => {
		const doctorDir = path.join(dir, ".doctor");
		const lockDir = path.join(doctorDir, "lock");
		mkdirSync(lockDir, { recursive: true });
		const old = new Date(Date.now() - 60 * 60 * 1000);
		utimesSync(lockDir, old, old);
		const result = await acquireLock(doctorDir);
		expect(result.ok).toBe(false);
		expect(result.holder).toBe("stale-lock-unremovable");
	});
});

describe("mutate chokepoint", () => {
	async function makeRun() {
		const run = await createRunContext(dir, null);
		expect(run.artifactPersistence).toBe(true);
		return run;
	}

	it("rejects paths that escape the scope root", async () => {
		const run = await makeRun();
		await expect(mutate(run, { path: "/etc/passwd", scopeRoot: dir, op: "append", content: "x\n" })).rejects.toThrow(MutateError);
	});

	it("rejects op=create when the target already exists", async () => {
		const run = await makeRun();
		write(path.join(dir, ".gitignore"), "node_modules\n");
		await expect(mutate(run, { path: path.join(dir, ".gitignore"), scopeRoot: dir, op: "create", content: "y\n" })).rejects.toThrow(MutateError);
	});

	it("records before/after hashes in actions.jsonl", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		const run = await makeRun();
		const action = await mutate(run, { path: path.join(dir, ".gitignore"), scopeRoot: dir, op: "append", content: ".doctor/\n" });
		expect(action.beforeHash).not.toBeNull();
		expect(action.afterHash).not.toBe(action.beforeHash);
	});

	it("resolveInside returns null for traversal outside the root", async () => {
		expect(await resolveInside(dir, "../../outside.txt")).toBeNull();
	});

	it("resolveInside tolerates nonexistent children and roots", async () => {
		expect(await resolveInside(dir, "does/not/exist.txt")).not.toBeNull();
		const missingRoot = path.join(dir, "missing-root");
		expect(await resolveInside(missingRoot, "child.txt")).not.toBeNull();
	});
});

describe("report artifacts", () => {
	it("writeReport is a no-op when persistence is disabled", async () => {
		const run = {
			runId: "20261105T000000Z__noart1",
			startedAt: "2026-11-05T00:00:00.000Z",
			doctorDir: path.join(dir, ".doctor"),
			runDir: path.join(dir, ".doctor", "runs", "20261105T000000Z__noart1"),
			backupsDir: path.join(dir, ".doctor", "runs", "20261105T000000Z__noart1", "backups"),
			artifactPersistence: false,
		};
		await writeReport(run, fakeReport(run.runId));
		expect(existsSync(run.runDir)).toBe(false);
	});
});

describe("diagnose fix refusal paths", () => {
	it("exits 4 when .doctor is a regular file (artifacts unwritable)", async () => {
		gitInit(dir);
		write(path.join(dir, ".gitignore"), "node_modules\n");
		write(path.join(dir, ".doctor"), "not a directory\n");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, fix: true })).toBe(4);
	});

	it("prints the human report (non-silent path)", async () => {
		gitInit(dir);
		const log = spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir })).toBe(1);
		expect(log.mock.calls.flat().join(" ")).toContain("fm-io-gitignore-missing-doctor-dir");
	});

	it("--robot-triage emits the mega-command JSON", async () => {
		gitInit(dir);
		const log = spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir, silent: false, robotTriage: true })).toBe(1);
		const payload = JSON.parse(log.mock.calls[0]?.[0] as string) as { recommended_command: string; capabilities_url: string };
		expect(payload.capabilities_url).toContain("capabilities");
		expect(payload.recommended_command).toContain("--fix");
	});

	it("--explain prints JSON for a known finding", async () => {
		gitInit(dir);
		const log = spyOn(console, "log");
		expect(await runDoctorDiagnose({ cwd: dir, silent: true, explain: "fm-io-gitignore-missing-doctor-dir", json: true })).toBe(0);
		expect(log.mock.calls.flat().join(" ")).toContain("fm-io-gitignore-missing-doctor-dir");
	});

	it("--quick skips the AST smoke detector", async () => {
		gitInit(dir);
		const code = await runDoctorDiagnose({ cwd: dir, silent: true, quick: true });
		expect(code).toBe(1);
	});

	it("--only scopes detectors to the named ids", async () => {
		gitInit(dir);
		const code = await runDoctorDiagnose({ cwd: dir, silent: true, only: "fm-runtime-not-bun" });
		expect(code).toBe(0);
	});
});
