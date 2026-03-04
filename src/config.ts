// Project config loader and shared exclusion utilities for rule-validator.config.json
// Walks from startDir toward fs root to find the config file
import { promises as fs } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
import { type } from "arktype";

const RuleConfig = type({ "exclude?": "string[]" });

const ProjectConfigSchema = type({
	"exclude?": "string[]",
	"rules?": type({ "[string]": RuleConfig }),
});

export type ProjectConfig = typeof ProjectConfigSchema.infer;

export async function loadProjectConfig(startDir?: string): Promise<ProjectConfig> {
	const dir = startDir ?? process.cwd();
	const configPath = await findConfigFile(dir);
	if (!configPath) return {};
	return parseConfigFile(configPath);
}

async function findConfigFile(startDir: string): Promise<string | null> {
	let current = path.resolve(startDir);
	while (true) {
		const candidate = path.join(current, "rule-validator.config.json");
		const exists = await fileExists(candidate);
		if (exists) return candidate;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	return fs
		.access(filePath)
		.then(() => true)
		.catch(() => false);
}

async function parseConfigFile(configPath: string): Promise<ProjectConfig> {
	const raw = await fs.readFile(configPath, "utf-8");
	const parsed = parseJson(raw, configPath);
	return validateConfig(parsed, configPath);
}

function parseJson(raw: string, configPath: string): unknown {
	try {
		return JSON.parse(raw);
	} catch (e) {
		throw new Error(
			`rule-validator.config.json at ${configPath} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}

function validateConfig(parsed: unknown, configPath: string): ProjectConfig {
	const result = ProjectConfigSchema(parsed);
	if (result instanceof type.errors) {
		throw new Error(`rule-validator.config.json at ${configPath} is invalid: ${result.summary}`);
	}
	return result;
}

export function isFileExcludedForRule(
	relPath: string,
	ruleName: string,
	ruleExcludes: Record<string, { exclude?: string[] }>,
): boolean {
	const patterns = ruleExcludes[ruleName]?.exclude;
	if (!patterns || patterns.length === 0) return false;
	return patterns.some((pattern) => minimatch(relPath, pattern, { matchBase: false }));
}
