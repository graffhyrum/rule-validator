// Integration test for the AST pipeline against known-bad.ts fixture.
// Bypasses runAstRules() to avoid the default __fixtures__ exclusion.
import { beforeAll, describe, expect, it } from "bun:test";
import { runAstRules } from "./ast-scan.ts";
import { AST_RULES } from "./rules/all-rules.ts";
import type { RuleResult } from "./rules/runner.ts";
import { runRules } from "./rules/runner.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

const FIXTURE_PATTERN = "src/rules/__fixtures__/known-bad.ts";

type RunAstRulesResult = Awaited<ReturnType<typeof runAstRules>>;

async function scanFixture(): Promise<RuleResult[]> {
	const analyzer = await createAnalyzer({ pattern: FIXTURE_PATTERN });
	return runRules({ analyzer, rules: AST_RULES });
}

describe("runAstRules", () => {
	let emptyExcludeResult: RunAstRulesResult;
	let jsonResult: RunAstRulesResult;

	beforeAll(async () => {
		emptyExcludeResult = await runAstRules(FIXTURE_PATTERN, { excludePatterns: [] });
		jsonResult = await runAstRules(FIXTURE_PATTERN, { excludePatterns: [], json: true });
	});

	it("returns violations when excludePatterns is empty", () => {
		expect(emptyExcludeResult.errorCount + emptyExcludeResult.warningCount).toBeGreaterThan(0);
		expect(emptyExcludeResult.displayViolations).toBeDefined();
		expect(emptyExcludeResult.displayViolations!.length).toBeGreaterThan(0);
	});

	it("collects json violations when json is true", () => {
		expect(jsonResult.violations).toBeDefined();
		expect(jsonResult.violations!.length).toBeGreaterThan(0);
		expect(jsonResult.violations!.at(0)?.file).toContain("known-bad.ts");
	});

	it("returns zero violations when fixture is excluded by default patterns", async () => {
		const result = await runAstRules(FIXTURE_PATTERN);
		expect(result.errorCount).toBe(0);
		expect(result.warningCount).toBe(0);
	});

	it("toScanResult: errorCount and warningCount match displayViolations severities", () => {
		const display = emptyExcludeResult.displayViolations ?? [];
		const errors = display.filter((v) => v.rule.severity === "error").length;
		const warnings = display.filter((v) => v.rule.severity === "warning").length;
		expect(emptyExcludeResult.errorCount).toBe(errors);
		expect(emptyExcludeResult.warningCount).toBe(warnings);
	});
});

describe("AST pipeline integration — known-bad.ts", () => {
	let results: RuleResult[];

	beforeAll(async () => {
		results = await scanFixture();
	});

	it("produces violations with valid file paths, locations, and code snippets", () => {
		const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
		expect(totalViolations).toBeGreaterThan(0);

		for (const result of results) {
			expect(result.file).toContain("known-bad.ts");
			for (const v of result.violations) {
				expect(v.location.line).toBeGreaterThan(0);
				expect(v.location.column).toBeGreaterThan(0);
				expect(typeof v.code).toBe("string");
				expect(v.code.length).toBeGreaterThan(0);
			}
		}
	});
});
