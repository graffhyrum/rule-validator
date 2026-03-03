import * as ts from "typescript";
import type { ASTRule, RuleContext } from "../rules/index.js";
import { createViolation } from "../rules/index.js";
import { is } from "../typescript/index.js";

const MESSAGE = "Static-only class detected. Convert to module-level functions.";

export const noStaticClassesRule: ASTRule = {
	name: "no-static-classes",
	description: "Disallow classes with only static members",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (is.classDeclaration(node) && node.name) {
			const hasInstanceMembers = node.members.some((member) => {
				if (is.constructorDeclaration(member)) {
					return true;
				}
				if (isNonStaticMember(member)) {
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

function isNonStaticMember(member: ts.ClassElement): boolean {
	const isMemberKind =
		is.propertyDeclaration(member) ||
		is.methodDeclaration(member) ||
		is.getAccessor(member) ||
		is.setAccessor(member);
	if (!isMemberKind) {
		return false;
	}
	return !member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
}
