import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"Unexpected non-null assertion (`!`). Use an assertDefined() guard or narrow the type explicitly.";

export const noNonNullAssertionRule: ASTRule = {
	name: "no-non-null-assertion",
	description: "Disallow non-null assertions using the ! operator",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.nonNullExpression(node)) {
			createViolation(context, node, MESSAGE);
		}
	},
};
