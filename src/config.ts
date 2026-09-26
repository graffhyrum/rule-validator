// Project config loader and shared exclusion utilities for rule-validator.config.json
// Walks from startDir toward fs root to find the config file
import { promises as fs } from "node:fs";
import path from "node:path";
import { type } from "arktype";
import { minimatch } from "minimatch";
import { type RelativePosixPath, toPosixPath } from "./paths.ts";

const rejectArray = (
	data: unknown,
	ctx: { reject: (problem: { expected: string; actual: string }) => boolean },
) => {
	if (Array.isArray(data)) return ctx.reject({ expected: "object", actual: "array" });
	return true;
};

const RuleConfig = type({ "exclude?": "string[]" }).onUndeclaredKey("reject").narrow(rejectArray);

const RulesConfig = type({ "[string]": RuleConfig }).narrow(rejectArray);

const ProjectConfigSchema = type({
	"exclude?": "string[]",
	"rules?": RulesConfig,
})
	.onUndeclaredKey("reject")
	.narrow((data, ctx) => {
		if (Array.isArray(data)) return ctx.reject({ expected: "object", actual: "array" });
		return true;
	});

export type ProjectConfig = typeof ProjectConfigSchema.infer;
export type RuleExcludes = NonNullable<ProjectConfig["rules"]>;

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
	try {
		await fs.access(filePath);
		return true;
	} catch (error) {
		if (isEnoent(error)) return false;
		throw error;
	}
}

function isEnoent(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function parseConfigFile(configPath: string): Promise<ProjectConfig> {
	const raw = await Bun.file(configPath).text();
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
	relPath: RelativePosixPath | string,
	ruleName: string,
	ruleExcludes: RuleExcludes,
): boolean {
	const patterns = ruleExcludes[ruleName]?.exclude;
	if (!patterns || patterns.length === 0) return false;
	return patterns.some((pattern) =>
		minimatch(toPosixPath(relPath), toPosixPath(pattern), { matchBase: false }),
	);
}
