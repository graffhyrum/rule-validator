import type * as ts from "typescript";
import type { AnalyzerContext } from "../typescript/compiler.js";
import type { Severity } from "./registry.js";

export interface RuleViolation {
	rule: ASTRule;
	node: ts.Node;
	message: string;
	severity: Severity;
}

export interface RuleContext {
	rule: ASTRule;
	analyzer: AnalyzerContext;
	sourceFile: ts.SourceFile;
	addViolation: (violation: Omit<RuleViolation, "rule" | "severity">) => void;
}

export interface ASTRule {
	name: string;
	description: string;
	severity: Severity;
	visit: (context: RuleContext, node: ts.Node) => void;
}

export interface RuleModule {
	rule: ASTRule;
}

export function createViolation(context: RuleContext, node: ts.Node, message: string): void {
	context.addViolation({
		node,
		message,
	});
}
