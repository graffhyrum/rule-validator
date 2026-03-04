// Integration test for the AST pipeline against known-bad.ts fixture.
// Bypasses runAstRules() to avoid the default __fixtures__ exclusion.
import { beforeAll, describe, expect, it, mock } from "bun:test";
import { AST_RULES } from "./rules/all-rules.ts";
import type { RuleResult } from "./rules/runner.ts";
import { runRules } from "./rules/runner.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

const FIXTURE_PATTERN = "src/rules/__fixtures__/known-bad.ts";

// runAstRules is mocked by cli.test.ts at module load time; restore and re-import
// to obtain the real implementation regardless of test file execution order.
type RunAstRulesFn = typeof import("./ast-scan.ts")["runAstRules"];
let runAstRules: RunAstRulesFn;

const RULES_EXPECTED_IN_FIXTURE = [
	"no-non-null-assertion",
	"no-unknown-as-cast",
	"no-static-classes",
];

async function scanFixture(): Promise<RuleResult[]> {
	const analyzer = await createAnalyzer({ pattern: FIXTURE_PATTERN });
	return runRules({ analyzer, rules: AST_RULES });
}

function violationsForRule(results: RuleResult[], ruleName: string) {
	return results.flatMap((r) => r.violations.filter((v) => v.rule.name === ruleName));
}

describe("runAstRules", () => {
	beforeAll(async () => {
		mock.restore();
		// Use cache-busting query to bypass the mock-contaminated module cache.
		// cli.test.ts replaces ./ast-scan.ts with a stub at load time; ?fresh forces
		// a fresh evaluation so this describe block always tests the real implementation.
		// biome-ignore lint/suspicious/noExplicitAny: cache-busting path has no type declaration
		const mod = (await import("./ast-scan.ts?fresh" as any)) as typeof import("./ast-scan.ts");
		runAstRules = mod.runAstRules;
	});

	it("returns violations when excludePatterns is empty", async () => {
		const result = await runAstRules(FIXTURE_PATTERN, { excludePatterns: [] });
		expect(result.errorCount + result.warningCount).toBeGreaterThan(0);
		expect(result.displayViolations).toBeDefined();
		expect(result.displayViolations!.length).toBeGreaterThan(0);
	});

	it("collects json violations when json is true", async () => {
		const result = await runAstRules(FIXTURE_PATTERN, { excludePatterns: [], json: true });
		expect(result.violations).toBeDefined();
		expect(result.violations!.length).toBeGreaterThan(0);
		expect(result.violations!.at(0)?.file).toContain("known-bad.ts");
	});

	it("returns zero violations when fixture is excluded by default patterns", async () => {
		const result = await runAstRules(FIXTURE_PATTERN);
		expect(result.errorCount).toBe(0);
		expect(result.warningCount).toBe(0);
	});

	it("toScanResult: errorCount and warningCount match displayViolations severities", async () => {
		const result = await runAstRules(FIXTURE_PATTERN, { excludePatterns: [] });
		const display = result.displayViolations ?? [];
		const errors = display.filter((v) => v.rule.severity === "error").length;
		const warnings = display.filter((v) => v.rule.severity === "warning").length;
		expect(result.errorCount).toBe(errors);
		expect(result.warningCount).toBe(warnings);
	});
});

describe("AST pipeline integration — known-bad.ts", () => {
	it("produces at least one violation overall", async () => {
		const results = await scanFixture();
		const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
		expect(totalViolations).toBeGreaterThan(0);
	});

	it("all violations reference the known-bad.ts file", async () => {
		const results = await scanFixture();
		for (const result of results) {
			expect(result.file).toContain("known-bad.ts");
		}
	});

	it("all violations have positive line and column numbers", async () => {
		const results = await scanFixture();
		for (const result of results) {
			for (const v of result.violations) {
				expect(v.location.line).toBeGreaterThan(0);
				expect(v.location.column).toBeGreaterThan(0);
			}
		}
	});

	for (const ruleName of RULES_EXPECTED_IN_FIXTURE) {
		it(`fires at least one violation for rule: ${ruleName}`, async () => {
			const results = await scanFixture();
			const violations = violationsForRule(results, ruleName);
			expect(violations.length).toBeGreaterThan(0);
		});
	}

	it("no-non-null-assertion violations have error severity", async () => {
		const results = await scanFixture();
		const violations = violationsForRule(results, "no-non-null-assertion");
		for (const v of violations) {
			expect(v.severity).toBe("error");
		}
	});

	it("no-unknown-as-cast violations have error severity", async () => {
		const results = await scanFixture();
		const violations = violationsForRule(results, "no-unknown-as-cast");
		for (const v of violations) {
			expect(v.severity).toBe("error");
		}
	});

	it("no-static-classes violations have error severity", async () => {
		const results = await scanFixture();
		const violations = violationsForRule(results, "no-static-classes");
		for (const v of violations) {
			expect(v.severity).toBe("error");
		}
	});

	it("violation code snippets are non-empty strings", async () => {
		const results = await scanFixture();
		for (const result of results) {
			for (const v of result.violations) {
				expect(typeof v.code).toBe("string");
				expect(v.code.length).toBeGreaterThan(0);
			}
		}
	});
});
