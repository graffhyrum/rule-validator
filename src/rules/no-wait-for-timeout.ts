import type * as ts from "typescript";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"Unexpected static timeout. Use Playwright auto-waiting or web-first assertions instead.";

export const noWaitForTimeoutRule: ASTRule = {
	name: "no-waitForTimeout",
	description: "Disallow waitForTimeout in Playwright tests",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.callExpression(node)) {
			const expr = node.expression;
			if (is.propertyAccessExpression(expr)) {
				const propName = expr.name.getText(context.sourceFile);
				if (propName === "waitForTimeout") {
					createViolation(context, node, MESSAGE);
				}
			}
		}
	},
};
