import type { JsonViolation, ScanResult } from "./index.ts";
import { printViolations } from "./index.ts";
import { noAnyTypesRule } from "./rules/no-any-types.ts";
import { noExpectTypeofToBeRule } from "./rules/no-expect-typeof-tobe.ts";
import { noNonNullAssertionRule } from "./rules/no-non-null-assertion.ts";
import { noStaticClassesRule } from "./rules/no-static-classes.ts";
import { noToBeInstanceOfRule } from "./rules/no-to-be-instance-of.ts";
import { noUnknownAsCastRule } from "./rules/no-unknown-as-cast.ts";
import { noWaitForTimeoutRule } from "./rules/no-wait-for-timeout.ts";
import type { ASTRule } from "./rules/rule.ts";
import { type FoundViolation, type RuleResult, runRules } from "./rules/runner.ts";
import { templateLiteralsOnlyRule } from "./rules/template-literals-only.ts";
import { createAnalyzer } from "./typescript/compiler.ts";

const AST_RULES: ASTRule[] = [
	noAnyTypesRule,
	noExpectTypeofToBeRule,
	noNonNullAssertionRule,
	noStaticClassesRule,
	noToBeInstanceOfRule,
	noUnknownAsCastRule,
	noWaitForTimeoutRule,
	templateLiteralsOnlyRule,
];

export type { JsonViolation };

export async function runAstRules(pattern: string, json?: boolean): Promise<ScanResult> {
	const analyzer = await createAnalyzer({ pattern });
	const results: RuleResult[] = runRules({ analyzer, rules: AST_RULES });
	return toScanResult(results, json);
}

function toScanResult(results: RuleResult[], json?: boolean): ScanResult {
	let errorCount = 0;
	let warningCount = 0;
	const jsonViolations: JsonViolation[] = [];
	for (const result of results) {
		for (const v of result.violations) {
			if (v.severity === "error") errorCount++;
			else warningCount++;
		}
		if (json) {
			for (const v of result.violations) {
				jsonViolations.push(toJsonViolation(result.file, v));
			}
		} else {
			printAstViolations(result);
		}
	}
	return { errorCount, warningCount, violations: json ? jsonViolations : undefined };
}

function toJsonViolation(file: string, v: FoundViolation): JsonViolation {
	return {
		file,
		line: v.location.line,
		column: v.location.column,
		rule: v.rule.name,
		message: v.message,
		severity: v.severity,
		match: v.code,
	};
}

function printAstViolations(result: RuleResult): void {
	const violations = result.violations.map((v) => ({
		file: result.file,
		line: v.location.line,
		column: v.location.column,
		rule: { name: v.rule.name, pattern: /./g, message: v.message, severity: v.severity },
		match: v.code,
	}));
	if (violations.length > 0) {
		printViolations(result.file, violations);
	}
}
