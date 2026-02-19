import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"BAN expect(x).toBeInstanceOf(C): Asserting constructor/instance type is a type-system concern; " +
	"use TypeScript and behavior-focused assertions instead.";

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
