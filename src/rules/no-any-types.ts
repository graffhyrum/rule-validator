import type * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE =
	"STRICT MODE: No any types, define schemas with arkType, infer types from the schemas with 'typeof schema.infer', and narrow variables with TS assertion functions. (function assertIsSomeType(x:unknown): asserts x is SomeType { someTypeSchema.assert(x);}; )";

export const noAnyTypesRule: ASTRule = {
	name: "no-any-types",
	description: "Disallow use of 'any' type in TypeScript",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.typeReference(node)) {
			const typeName = node.typeName.getText(context.sourceFile);
			if (typeName === "any") {
				createViolation(context, node, MESSAGE);
			}
		} else if (is.anyKeyword(node)) {
			createViolation(context, node, MESSAGE);
		}
	},
};
