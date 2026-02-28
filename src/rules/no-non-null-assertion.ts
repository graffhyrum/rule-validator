import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"BAN non-null assertion (!): Use assertDefined() instead. Either import an existing assertDefined function or create one in a utils file:\n\n" +
	"export function assertDefined<T>(x: unknown): asserts x is NonNullable<T> {\n" +
	"  if (x === undefined) throw new Error('Unexpected undefined value');\n" +
	"  if (x === null) throw new Error('Unexpected null value');\n" +
	"}";

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
