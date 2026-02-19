import * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE = "AVOID STATIC-ONLY CLASSES: Convert to module functions";

export const noStaticClassesRule: ASTRule = {
	name: "no-static-classes",
	description: "Disallow classes with only static members",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.classDeclaration(node) && node.name) {
			const hasInstanceMembers = node.members.some((member) => {
				if (
					is.propertyDeclaration(member) &&
					!member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
				) {
					return true;
				}
				if (
					is.methodDeclaration(member) &&
					!member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
				) {
					return true;
				}
				return false;
			});

			if (!hasInstanceMembers && node.members.length > 0) {
				createViolation(context, node, MESSAGE);
			}
		}
	},
};
