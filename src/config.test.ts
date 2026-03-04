// Tests for project config loading, validation, and exclusion integration
// Covers: discovery, merging, per-rule exclusions, error cases, scan integration
import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProjectConfig } from "./config.ts";
import { scanFile, scanFiles } from "./index.ts";

function makeTempDir(): string {
	const dir = path.join(os.tmpdir(), `rv-config-test-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("loadProjectConfig", () => {
	let tmpDir: string;

	afterEach(() => {
		if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
	});

	it("returns empty object when no config file exists", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-no-config-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		const config = await loadProjectConfig(tmpDir);
		expect(config).toEqual({});
	});

	it("loads and returns valid config from startDir", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-valid-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(
			path.join(tmpDir, "rule-validator.config.json"),
			JSON.stringify({ exclude: ["legacy/**", "src/generated/**"] }),
		);
		const config = await loadProjectConfig(tmpDir);
		expect(config.exclude).toEqual(["legacy/**", "src/generated/**"]);
	});

	it("loads per-rule exclusions", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-rules-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(
			path.join(tmpDir, "rule-validator.config.json"),
			JSON.stringify({
				rules: {
					"no-non-null-assertion": { exclude: ["src/adapters/**"] },
				},
			}),
		);
		const config = await loadProjectConfig(tmpDir);
		expect(config.rules?.["no-non-null-assertion"]?.exclude).toEqual(["src/adapters/**"]);
	});

	it("discovers config by walking up toward fs root", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-walk-${Date.now()}`);
		const subDir = path.join(tmpDir, "a", "b", "c");
		mkdirSync(subDir, { recursive: true });
		writeFileSync(
			path.join(tmpDir, "rule-validator.config.json"),
			JSON.stringify({ exclude: ["found/**"] }),
		);
		const config = await loadProjectConfig(subDir);
		expect(config.exclude).toEqual(["found/**"]);
	});

	it("throws a clear error for invalid JSON", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-badjson-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(path.join(tmpDir, "rule-validator.config.json"), "{ not valid json }");
		await expect(loadProjectConfig(tmpDir)).rejects.toThrow("not valid JSON");
	});

	it("throws a clear error for schema violations", async () => {
		tmpDir = path.join(os.tmpdir(), `rv-badschema-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(
			path.join(tmpDir, "rule-validator.config.json"),
			JSON.stringify({ exclude: "not-an-array" }),
		);
		await expect(loadProjectConfig(tmpDir)).rejects.toThrow("invalid");
	});
});

describe("config exclusion integration", () => {
	const testDir = path.join(process.cwd(), ".test-tmp");
	let fixtureDir: string;

	afterEach(() => {
		if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
	});

	it("per-rule exclude suppresses violations for that rule only", async () => {
		fixtureDir = path.join(testDir, `e2e-${Date.now()}`);
		mkdirSync(fixtureDir, { recursive: true });
		const fixturePath = path.join(fixtureDir, "target.ts");
		writeFileSync(
			fixturePath,
			'const a = "hello" as unknown as number;\nconst b = "x" + "y";\n',
		);
		const relPattern = path.relative(process.cwd(), fixtureDir) + "/target.ts";
		const ruleExcludes = { "no-unknown-as-cast": { exclude: [relPattern] } };
		const violations = await scanFile(fixturePath, undefined, ruleExcludes);
		const ruleNames = violations.map((v) => v.rule.name);
		expect(ruleNames).not.toContain("no-unknown-as-cast");
		expect(ruleNames).toContain("template-literals-only");
	});

	it("global exclude prevents file from being scanned at all", async () => {
		fixtureDir = path.join(testDir, `e2e-global-${Date.now()}`);
		const srcDir = path.join(fixtureDir, "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(path.join(srcDir, "target.ts"), 'const a = "hello" as unknown as number;\n');
		const relSrc = path.relative(process.cwd(), srcDir);
		const result = await scanFiles(`${relSrc}/**/*.ts`, { config: { exclude: [`${relSrc}/**`] } });
		expect(result.errorCount).toBe(0);
	});
});
