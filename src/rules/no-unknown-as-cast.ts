import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"Double cast via `as unknown as T` bypasses type safety. Use assertion functions or proper typing.";

export const noUnknownAsCastRule: ASTRule = {
	name: "no-unknown-as-cast",
	description: "Disallow double casting through unknown (as unknown as T)",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.asExpression(node)) {
			const exprType = node.expression;
			if (is.asExpression(exprType)) {
				const innerType = exprType.type;
				if (is.unknownKeyword(innerType)) {
					createViolation(context, node, MESSAGE);
				}
			}
		}
	},
};
