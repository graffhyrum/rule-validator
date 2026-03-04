// Tests for project config loading and validation
// Covers: discovery, merging, per-rule exclusions, error cases
import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadProjectConfig } from "./config.ts";

function makeTempDir(): string {
	return mkdirSync(path.join(os.tmpdir(), `rv-config-test-${Date.now()}`), { recursive: true }) as unknown as string
		?? path.join(os.tmpdir(), `rv-config-test-${Date.now()}`);
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
