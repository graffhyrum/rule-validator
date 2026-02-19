import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"AVOID STATIC TIMEOUTS: Use Playwright's auto-waiting and web-first assertions instead of waitForTimeout(). See https://playwright.dev/docs/actionability and https://playwright.dev/docs/best-practices#use-web-first-assertions";

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
