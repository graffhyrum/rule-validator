import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE = "Unexpected `any` type. Use explicit types or ArkType schemas.";

export const noAnyTypesRule: ASTRule = {
	name: "no-any-types",
	description: "Disallow use of 'any' type in TypeScript",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.anyKeyword(node)) {
			createViolation(context, node, MESSAGE);
		}
	},
};
