import path from "node:path";
import { describe, expect, it } from "bun:test";
import { Glob } from "bun";
import { preferBunFileIoRule } from "../packages/file-io/index.ts";
import { RULES } from "../rules.js";
import { AST_RULES } from "./all-rules.js";

const INFRA_FILES = new Set(["index.ts", "rule.ts", "runner.ts", "test-helpers.ts"]);
describe("AST_RULES registration guard", () => {
	it("every rule exported from src/rules is registered in AST_RULES", async () => {
		const registeredNames = new Set(AST_RULES.map((r) => r.name));
		const ruleFiles = await collectRuleFiles();
		for (const file of ruleFiles) {
			const basename = path.basename(file);
			const mod = await import(`./${basename}`);
			const exportedRules = Object.values(mod).filter(
				(
					v,
				): v is {
					name: string;
				} => typeof v === "object" && v !== null && "name" in v && "visit" in v,
			);
			for (const rule of exportedRules) {
				expect(
					registeredNames.has(rule.name),
					`Rule "${rule.name}" from ${file} is not registered in AST_RULES`,
				).toBe(true);
			}
		}
	});
});
describe("package entry rules", () => {
	it("registers prefer-bun-file-io from its package entry point", () => {
		const registeredNames = new Set(AST_RULES.map((r) => r.name));
		expect(registeredNames.has(preferBunFileIoRule.name)).toBe(true);
	});
});
describe("AST_RULES severity contract", () => {
	it("every AST rule that has a regex counterpart shares the same severity", () => {
		const regexRulesBySeverity = buildRegexSeverityMap();
		const mismatches = findSeverityMismatches(regexRulesBySeverity);
		expect(mismatches).toEqual([]);
	});
});
function buildRegexSeverityMap(): Map<string, string> {
	const map = new Map<string, string>();
	for (const rule of RULES) {
		map.set(rule.name, rule.severity);
	}
	return map;
}
function findSeverityMismatches(regexSeverity: Map<string, string>): string[] {
	const mismatches: string[] = [];
	for (const astRule of AST_RULES) {
		const regexSev = regexSeverity.get(astRule.name);
		if (regexSev !== undefined && regexSev !== astRule.severity) {
			mismatches.push(`${astRule.name}: AST="${astRule.severity}" regex="${regexSev}"`);
		}
	}
	return mismatches;
}
async function collectRuleFiles(): Promise<string[]> {
	const glob = new Glob("src/rules/*.ts");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: process.cwd() })) {
		if (isRuleFile(file)) files.push(file);
	}
	return files;
}
function isRuleFile(file: string): boolean {
	const basename = path.basename(file);
	return !(
		INFRA_FILES.has(basename) ||
		basename.endsWith(".test.ts") ||
		basename.startsWith("all-rules")
	);
}
