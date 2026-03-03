// Integration test for the AST pipeline against known-bad.ts fixture.
// Bypasses runAstRules() to avoid the default __fixtures__ exclusion.
import { describe, expect, it } from "bun:test";
import { AST_RULES } from "./rules/all-rules.ts";
import type { RuleResult } from "./rules/runner.ts";
import { runRules } from "./rules/runner.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

const FIXTURE_PATTERN = "src/rules/__fixtures__/known-bad.ts";

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
