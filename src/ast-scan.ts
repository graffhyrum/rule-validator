import type { ScanResult } from "./index.ts";
import { printViolations } from "./index.ts";
import { AST_RULES } from "./rules/all-rules.ts";
import type { RuleResult } from "./rules/runner.ts";
import { runRules } from "./rules/runner.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

export type { JsonViolation } from "./index.ts";

export async function runAstRules(pattern: string, json?: boolean): Promise<ScanResult> {
	const analyzer = await createAnalyzer({
		pattern,
		excludePatterns: ["**/__fixtures__/**", "**/*.test.ts", "**/*.test.tsx"],
	});
	const results: RuleResult[] = runRules({ analyzer, rules: AST_RULES });
	return toScanResult(results, json);
}

function toScanResult(results: RuleResult[], json?: boolean): ScanResult {
	let errorCount = 0;
	let warningCount = 0;
	for (const result of results) {
		for (const v of result.violations) {
			if (v.severity === "error") errorCount++;
			else warningCount++;
		}
		if (!json && result.violations.length > 0) {
			printAstViolations(result);
		}
	}
	const violations = json ? collectJsonViolations(results) : undefined;
	return { errorCount, warningCount, violations };
}

function collectJsonViolations(results: RuleResult[]) {
	return results.flatMap((r) =>
		r.violations.map((v) => ({
			file: r.file,
			line: v.location.line,
			column: v.location.column,
			rule: v.rule.name,
			message: v.message,
			severity: v.severity,
			match: v.code,
		})),
	);
}

function printAstViolations(result: RuleResult): void {
	const violations = result.violations.map((v) => ({
		file: result.file,
		line: v.location.line,
		column: v.location.column,
		rule: { name: v.rule.name, message: v.message, severity: v.severity },
		match: v.code,
	}));
	printViolations(result.file, violations);
}
