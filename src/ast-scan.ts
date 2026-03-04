import type { DisplayViolation, ScanResult } from "./index.ts";
import { AST_RULES } from "./rules/all-rules.ts";
import type { RuleResult } from "./rules/runner.ts";
import { runRules } from "./rules/runner.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

export type { JsonViolation } from "./index.ts";

const DEFAULT_EXCLUDE_PATTERNS = ["**/__fixtures__/**", "**/*.test.ts", "**/*.test.tsx"] as const;

export interface AstScanOptions {
	json?: boolean;
	excludePatterns?: readonly string[];
}

export async function runAstRules(pattern: string, options?: AstScanOptions): Promise<ScanResult> {
	const excludePatterns = options?.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
	const analyzer = await createAnalyzer({ pattern, excludePatterns: [...excludePatterns] });
	const results: RuleResult[] = runRules({ analyzer, rules: AST_RULES });
	return toScanResult(results, options?.json);
}

function toScanResult(results: RuleResult[], json?: boolean): ScanResult {
	let errorCount = 0;
	let warningCount = 0;
	const displayViolations: DisplayViolation[] = [];
	for (const result of results) {
		for (const v of result.violations) {
			if (v.severity === "error") errorCount++;
			else warningCount++;
			displayViolations.push({
				file: result.file,
				line: v.location.line,
				column: v.location.column,
				rule: { name: v.rule.name, message: v.message, severity: v.severity },
				match: v.code,
			});
		}
	}
	const violations = json ? collectJsonViolations(results) : undefined;
	return { errorCount, warningCount, violations, displayViolations };
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
