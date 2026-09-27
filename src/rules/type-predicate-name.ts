import * as ts from "typescript";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";
const GUARD_NAME = /^(is|has)[A-Z]/;
const ASSERT_NAME = /^(is|has|assert)[A-Z]/;
type PredicateKind = "guard" | "assertion";
interface PredicateSite {
	readonly name: string;
	readonly kind: PredicateKind;
	readonly report: ts.Node;
}
type SignatureNode =
	| ts.FunctionDeclaration
	| ts.MethodDeclaration
	| ts.MethodSignature
	| ts.FunctionExpression;
type BindingNode =
	| ts.VariableDeclaration
	| ts.PropertyDeclaration
	| ts.PropertySignature
	| ts.PropertyAssignment;
export const typePredicateNameRule: ASTRule = {
	name: "type-predicate-name",
	description: "Type predicates start with is or has. Assertion functions may start with assert.",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		const site = predicateSite(node);
		if (site === undefined || isAllowedName(site.name, site.kind)) {
			return;
		}
		createViolation(context, site.report, messageFor(site));
	},
};
function predicateSite(node: ts.Node): PredicateSite | undefined {
	if (isSignatureNode(node)) {
		return siteFromSignature(node);
	}
	if (isBindingNode(node)) {
		return siteFromBinding(node);
	}
	return undefined;
}
function siteFromBinding(node: BindingNode): PredicateSite | undefined {
	const name = nodeName(node.name);
	if (name === undefined) {
		return undefined;
	}
	const annotated = functionPredicate(declaredType(node));
	if (annotated !== undefined) {
		return { name, kind: predicateKind(annotated), report: node };
	}
	return siteFromInitializer(node, name);
}
function functionPredicate(type: ts.TypeNode | undefined): ts.TypePredicateNode | undefined {
	if (type === undefined) {
		return undefined;
	}
	if (ts.isParenthesizedTypeNode(type)) {
		return functionPredicate(type.type);
	}
	if (ts.isFunctionTypeNode(type)) {
		return returnPredicate(type.type);
	}
	return undefined;
}
function siteFromInitializer(node: BindingNode, name: string): PredicateSite | undefined {
	const init = initializerOf(node);
	if (init === undefined || !isUnnamedFunction(init)) {
		return undefined;
	}
	const predicate = returnPredicate(init.type);
	if (predicate === undefined) {
		return undefined;
	}
	return { name, kind: predicateKind(predicate), report: init };
}
function siteFromSignature(node: SignatureNode): PredicateSite | undefined {
	const name = nodeName(node.name);
	const predicate = returnPredicate(node.type);
	if (name === undefined || predicate === undefined) {
		return undefined;
	}
	return { name, kind: predicateKind(predicate), report: node };
}
function isUnnamedFunction(node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression {
	if (ts.isArrowFunction(node)) {
		return true;
	}
	return ts.isFunctionExpression(node) && node.name === undefined;
}
function isSignatureNode(node: ts.Node): node is SignatureNode {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isMethodSignature(node) ||
		ts.isFunctionExpression(node)
	);
}
function isBindingNode(node: ts.Node): node is BindingNode {
	return (
		ts.isVariableDeclaration(node) ||
		ts.isPropertyDeclaration(node) ||
		ts.isPropertySignature(node) ||
		ts.isPropertyAssignment(node)
	);
}
function nodeName(name: ts.Node | undefined): string | undefined {
	if (name === undefined) {
		return undefined;
	}
	if (ts.isIdentifier(name)) {
		return name.text;
	}
	return undefined;
}
function declaredType(node: BindingNode): ts.TypeNode | undefined {
	if (ts.isPropertyAssignment(node)) {
		return undefined;
	}
	return node.type;
}
function initializerOf(node: BindingNode): ts.Expression | undefined {
	if (ts.isPropertySignature(node)) {
		return undefined;
	}
	return node.initializer;
}
function returnPredicate(type: ts.TypeNode | undefined): ts.TypePredicateNode | undefined {
	if (type !== undefined && ts.isTypePredicateNode(type)) {
		return type;
	}
	return undefined;
}
function predicateKind(predicate: ts.TypePredicateNode): PredicateKind {
	if (predicate.assertsModifier === undefined) {
		return "guard";
	}
	return "assertion";
}
function isAllowedName(name: string, kind: PredicateKind): boolean {
	switch (kind) {
		case "guard":
			return GUARD_NAME.test(name);
		case "assertion":
			return ASSERT_NAME.test(name);
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
function messageFor(site: PredicateSite): string {
	switch (site.kind) {
		case "guard":
			return `Type predicate ${site.name} must start with is or has.`;
		case "assertion":
			return `Assertion function ${site.name} must start with assert, is, or has.`;
		default: {
			const _exhaustive: never = site.kind;
			return _exhaustive;
		}
	}
}
