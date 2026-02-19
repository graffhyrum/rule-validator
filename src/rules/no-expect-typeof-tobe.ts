import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"BAN expect(typeof x).toBe(type): Asserting typeof is a type-system concern; " +
	"use TypeScript and interface contract tests (input→output), or arktype schema assertions, not runtime type checks.";

export const noExpectTypeofToBeRule: ASTRule = {
	name: "no-expect-typeof-tobe",
	description: "Disallow expect(typeof x).toBe() calls",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (
			is.callExpression(node) &&
			is.propertyAccessExpression(node.expression) &&
			node.expression.name.getText(context.sourceFile) === "toBe" &&
			is.callExpression(node.expression.expression) &&
			is.identifier(node.expression.expression.expression) &&
			node.expression.expression.expression.text === "expect" &&
			node.expression.expression.arguments.length === 1
		) {
			const expectArg = node.expression.expression.arguments[0];
			if (expectArg && is.typeOfExpression(expectArg)) {
				createViolation(context, node, MESSAGE);
			}
		}
	},
};
