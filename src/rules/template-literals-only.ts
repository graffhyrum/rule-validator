import * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE = "TEMPLATE LITERALS ONLY: Use template literal syntax not string concatenation";

export const templateLiteralsOnlyRule: ASTRule = {
	name: "template-literals-only",
	description: "Disallow string concatenation, require template literals",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (
			is.binaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
			(is.stringLiteral(node.left) || is.identifier(node.left)) &&
			(is.stringLiteral(node.right) || is.identifier(node.right))
		) {
			createViolation(context, node, MESSAGE);
		}
	},
};
