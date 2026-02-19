import type * as ts from "typescript";
import type { AnalyzerContext, NodeLocation } from "../typescript/compiler.js";
import { getNodeLocation, getNodeText, traverseSourceFile } from "../typescript/compiler.js";
import { getAllRules } from "./registry.js";
import type { ASTRule } from "./rule.js";

export interface RunRulesOptions {
	rules?: ASTRule[];
	analyzer: AnalyzerContext;
}

export interface RuleResult {
	file: string;
	violations: FoundViolation[];
}

export interface FoundViolation {
	rule: ASTRule;
	location: NodeLocation;
	message: string;
	severity: "error" | "warning";
	code: string;
}

export function runRules(options: RunRulesOptions): RuleResult[] {
	const rules = options.rules ?? getAllRules();
	const results: RuleResult[] = [];

	for (const [fileName, sourceFile] of options.analyzer.sourceFiles) {
		const violations = runRulesOnFile(rules, options.analyzer, sourceFile);
		if (violations.length > 0) {
			results.push({
				file: fileName,
				violations,
			});
		}
	}

	return results;
}

function runRulesOnFile(
	rules: ASTRule[],
	analyzer: AnalyzerContext,
	sourceFile: ts.SourceFile,
): FoundViolation[] {
	const violations: FoundViolation[] = [];

	for (const rule of rules) {
		const ruleContext = {
			rule,
			analyzer,
			sourceFile,
			addViolation: (v: { node: ts.Node; message: string }) => {
				const location = getNodeLocation(sourceFile, v.node);
				violations.push({
					rule,
					location,
					message: v.message,
					severity: rule.severity,
					code: getNodeText(sourceFile, v.node),
				});
			},
		};

		traverseSourceFile(
			sourceFile,
			(node) => {
				rule.visit(ruleContext, node);
			},
			null,
		);
	}

	return violations;
}
