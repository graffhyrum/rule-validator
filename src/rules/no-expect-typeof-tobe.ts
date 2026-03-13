import type * as ts from "typescript";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"Unexpected `expect(typeof x).toBe()`. Use TypeScript types or schema assertions instead of runtime type checks.";

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
