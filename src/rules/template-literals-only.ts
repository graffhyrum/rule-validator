import * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE = "Use template literals instead of string concatenation.";

function hasStringOperand(node: ts.BinaryExpression): boolean {
	return is.stringLiteral(node.left) || is.stringLiteral(node.right);
}

export const templateLiteralsOnlyRule: ASTRule = {
	name: "template-literals-only",
	description: "Disallow string concatenation, require template literals",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (!is.binaryExpression(node)) return;
		if (node.operatorToken.kind !== ts.SyntaxKind.PlusToken) return;
		if (!hasStringOperand(node)) return;
		createViolation(context, node, MESSAGE);
	},
};
