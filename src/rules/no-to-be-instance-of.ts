import type * as ts from "typescript";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"Unexpected `toBeInstanceOf()`. Use behavior-focused assertions instead of checking constructor types.";

export const noToBeInstanceOfRule: ASTRule = {
	name: "no-toBeInstanceOf",
	description: "Disallow expect(x).toBeInstanceOf() calls",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (
			is.callExpression(node) &&
			is.propertyAccessExpression(node.expression) &&
			node.expression.name.getText(context.sourceFile) === "toBeInstanceOf" &&
			is.callExpression(node.expression.expression) &&
			is.identifier(node.expression.expression.expression) &&
			node.expression.expression.expression.text === "expect"
		) {
			createViolation(context, node, MESSAGE);
		}
	},
};
