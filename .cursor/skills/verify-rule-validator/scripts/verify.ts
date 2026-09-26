#!/usr/bin/env bun
/**
 * Verification scaffolding for rule-validator CLI.
 * Invoked by `.cursor/skills/verify-rule-validator/SKILL.md`.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "../../../..");
const SKILL_ROOT = path.resolve(import.meta.dir, "..");
const ARTIFACTS_ROOT = path.join(SKILL_ROOT, "artifacts");
const CLI = path.join(REPO_ROOT, "src", "cli.ts");
const PACKAGE_JSON = path.join(REPO_ROOT, "package.json");

type Cmd = "doctor" | "seed" | "scan" | "cleanup" | "path";

function usage(): never {
	console.error(`Usage:
  bun .cursor/skills/verify-rule-validator/scripts/verify.ts doctor
  bun .cursor/skills/verify-rule-validator/scripts/verify.ts seed --run-id <id>
  bun .cursor/skills/verify-rule-validator/scripts/verify.ts path --run-id <id>
  bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <id> --pattern <glob> [--json] [--label <name>]
  bun .cursor/skills/verify-rule-validator/scripts/verify.ts cleanup --run-id <id>
`);
	process.exit(2);
}

function argValue(argv: string[], flag: string): string | undefined {
	const i = argv.indexOf(flag);
	if (i < 0) return undefined;
	return argv[i + 1];
}

function requireRunId(argv: string[]): string {
	const id = argValue(argv, "--run-id");
	if (!id || id.length === 0) {
		console.error("Missing --run-id");
		usage();
	}
	return id;
}

function scratchDir(runId: string): string {
	return path.join(tmpdir(), `rv-verify-${runId}`);
}

function artifactDir(runId: string): string {
	return path.join(ARTIFACTS_ROOT, runId);
}

async function doctor(): Promise<void> {
	const bun = Bun.spawnSync(["bun", "--version"], { stdout: "pipe", stderr: "pipe" });
	if (bun.exitCode !== 0) {
		console.error("doctor: bun not available");
		process.exit(1);
	}
	const bunVersion = bun.stdout.toString().trim();

	const pkg = JSON.parse(await Bun.file(PACKAGE_JSON).text()) as { version: string };
	const ver = Bun.spawnSync(["bun", "run", CLI, "--version"], {
		cwd: REPO_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	const cliVersion = ver.stdout.toString().trim();
	if (ver.exitCode !== 0 || cliVersion !== pkg.version) {
		console.error(
			`doctor: CLI version mismatch (cli=${cliVersion || "(empty)"} pkg=${pkg.version} exit=${ver.exitCode})`,
		);
		process.exit(1);
	}

	mkdirSync(ARTIFACTS_ROOT, { recursive: true });
	const probe = path.join(ARTIFACTS_ROOT, `.doctor-write-${Date.now()}`);
	writeFileSync(probe, "ok\n");
	rmSync(probe);

	console.log(
		JSON.stringify(
			{
				ok: true,
				bunVersion,
				cliVersion,
				repoRoot: REPO_ROOT,
				cli: CLI,
				artifactsRoot: ARTIFACTS_ROOT,
			},
			null,
			2,
		),
	);
}

function seed(runId: string): void {
	const root = scratchDir(runId);
	rmSync(root, { recursive: true, force: true });
	mkdirSync(path.join(root, "keep"), { recursive: true });
	mkdirSync(path.join(root, "skip"), { recursive: true });

	writeFileSync(
		path.join(root, "dirty.ts"),
		[
			'const concat = "Hello " + "world";',
			"class Utils {",
			"\tstatic add(a: number, b: number): number {",
			"\t\treturn a + b;",
			"\t}",
			"}",
			"const forced = null!;",
			'const cast = "x" as unknown as number;',
			"",
		].join("\n"),
	);

	writeFileSync(
		path.join(root, "clean.ts"),
		["const greeting = `Hello ${'world'}`;", "const n: number = 1;", ""].join("\n"),
	);

	writeFileSync(path.join(root, "keep", "shown.ts"), 'const y = "a" + "b";\n');
	writeFileSync(path.join(root, "skip", "hidden.ts"), 'const y = "a" + "b";\n');

	writeFileSync(
		path.join(root, "rule-validator.config.json"),
		`${JSON.stringify({ exclude: ["skip/**"] }, null, "\t")}\n`,
	);

	mkdirSync(artifactDir(runId), { recursive: true });
	writeFileSync(
		path.join(artifactDir(runId), "seed.json"),
		`${JSON.stringify({ runId, scratch: root, files: ["dirty.ts", "clean.ts", "keep/shown.ts", "skip/hidden.ts"] }, null, 2)}\n`,
	);

	console.log(JSON.stringify({ ok: true, runId, scratch: root }, null, 2));
}

async function scan(argv: string[]): Promise<void> {
	const runId = requireRunId(argv);
	const pattern = argValue(argv, "--pattern");
	if (!pattern) {
		console.error("Missing --pattern");
		usage();
	}
	const label = argValue(argv, "--label") ?? "scan";
	const json = argv.includes("--json");
	const root = scratchDir(runId);
	const outDir = artifactDir(runId);
	mkdirSync(outDir, { recursive: true });

	const args = ["run", CLI, pattern];
	if (json) args.push("--json");

	const proc = Bun.spawn(["bun", ...args], {
		cwd: root,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	const transcript = {
		runId,
		label,
		cwd: root,
		command: ["bun", ...args],
		exitCode,
		stdout,
		stderr,
		capturedAt: new Date().toISOString(),
	};
	const outPath = path.join(outDir, `${label}.json`);
	writeFileSync(outPath, `${JSON.stringify(transcript, null, 2)}\n`);
	const textPath = path.join(outDir, `${label}.txt`);
	writeFileSync(
		textPath,
		[
			`# ${label}`,
			`cwd: ${root}`,
			`command: bun ${args.join(" ")}`,
			`exitCode: ${exitCode}`,
			"",
			"## stdout",
			stdout,
			"## stderr",
			stderr,
			"",
		].join("\n"),
	);

	console.log(JSON.stringify({ ok: true, exitCode, artifact: outPath, text: textPath }, null, 2));
	process.exit(exitCode === 0 || exitCode === 1 ? 0 : exitCode);
}

function cleanup(runId: string): void {
	const root = scratchDir(runId);
	rmSync(root, { recursive: true, force: true });
	console.log(
		JSON.stringify(
			{
				ok: true,
				removedScratch: root,
				artifactsKept: artifactDir(runId),
			},
			null,
			2,
		),
	);
}

function printPath(runId: string): void {
	console.log(
		JSON.stringify(
			{
				scratch: scratchDir(runId),
				artifacts: artifactDir(runId),
			},
			null,
			2,
		),
	);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd) usage();

const known: Record<Cmd, true> = {
	doctor: true,
	seed: true,
	scan: true,
	cleanup: true,
	path: true,
};

if (!(cmd in known)) {
	console.error(`Unknown command: ${cmd}`);
	usage();
}

const command = cmd as Cmd;
switch (command) {
	case "doctor":
		await doctor();
		break;
	case "seed":
		seed(requireRunId(argv));
		break;
	case "scan":
		await scan(argv);
		break;
	case "cleanup":
		cleanup(requireRunId(argv));
		break;
	case "path":
		printPath(requireRunId(argv));
		break;
	default: {
		const _exhausted: never = command;
		console.error(`Unhandled command: ${_exhausted}`);
		usage();
	}
}
