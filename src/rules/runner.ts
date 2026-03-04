import path from "node:path";
import type * as ts from "typescript";
import { isFileExcludedForRule } from "../config.ts";
import type { AnalyzerContext, NodeLocation } from "../typescript/compiler.js";
import { getNodeLocation, getNodeText, traverseSourceFile } from "../typescript/compiler.js";
import type { Severity } from "./registry.js";
import type { ASTRule, RuleContext } from "./rule.js";

export interface RunRulesOptions {
	rules: ASTRule[];
	analyzer: AnalyzerContext;
	ruleExcludes?: Record<string, { exclude?: string[] }>;
}

export interface RuleResult {
	file: string;
	violations: FoundViolation[];
}

export interface FoundViolation {
	rule: ASTRule;
	location: NodeLocation;
	message: string;
	severity: Severity;
	code: string;
}

export function runRules(options: RunRulesOptions): RuleResult[] {
	const rules = options.rules;
	const ruleExcludes = options.ruleExcludes ?? {};
	const results: RuleResult[] = [];

	for (const [fileName, sourceFile] of options.analyzer.sourceFiles) {
		const relFile = path.relative(process.cwd(), fileName);
		const activeRules = rules.filter(
			(rule) => !isFileExcludedForRule(relFile, rule.name, ruleExcludes),
		);
		const violations = runRulesOnFile(activeRules, options.analyzer, sourceFile);
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
	const contexts = rules.map((rule) =>
		createRuleContext({ rule, analyzer, sourceFile, violations }),
	);

	traverseSourceFile(
		sourceFile,
		(node) => {
			for (const ctx of contexts) {
				ctx.rule.visit(ctx, node);
			}
		},
		null,
	);

	return violations;
}

interface RuleContextOptions {
	rule: ASTRule;
	analyzer: AnalyzerContext;
	sourceFile: ts.SourceFile;
	violations: FoundViolation[];
}

function createRuleContext(opts: RuleContextOptions): RuleContext {
	return {
		rule: opts.rule,
		analyzer: opts.analyzer,
		sourceFile: opts.sourceFile,
		addViolation: (v: { node: ts.Node; message: string }) => {
			opts.violations.push({
				rule: opts.rule,
				location: getNodeLocation(opts.sourceFile, v.node),
				message: v.message,
				severity: opts.rule.severity,
				code: getNodeText(opts.sourceFile, v.node),
			});
		},
	};
}
