import { describe, expect, it } from "bun:test";
import { Glob } from "bun";
import { AST_RULES } from "./all-rules.js";

const INFRA_FILES = new Set(["index.ts", "rule.ts", "runner.ts", "registry.ts", "test-helpers.ts"]);

function isRuleFile(file: string): boolean {
	const basename = file.split("/").at(-1) ?? "";
	return !(
		INFRA_FILES.has(basename) ||
		basename.endsWith(".test.ts") ||
		basename.startsWith("all-rules")
	);
}

async function collectRuleFiles(): Promise<string[]> {
	const glob = new Glob("src/rules/*.ts");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: process.cwd() })) {
		if (isRuleFile(file)) files.push(file);
	}
	return files;
}

describe("AST_RULES registration guard", () => {
	it("every rule exported from src/rules is registered in AST_RULES", async () => {
		const registeredNames = new Set(AST_RULES.map((r) => r.name));
		const ruleFiles = await collectRuleFiles();

		for (const file of ruleFiles) {
			const mod = await import(`../../${file}`);
			const exportedRules = Object.values(mod).filter(
				(v): v is { name: string } =>
					typeof v === "object" && v !== null && "name" in v && "visit" in v,
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
