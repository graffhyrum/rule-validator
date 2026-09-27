import * as ts from "typescript";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";

const ARKTYPE_SPECIFIER = "arktype";
const TYPE_EXPORT = "type";

// Format keywords the ArkType skill places before min, max, and pattern.
const BASIS_PATTERN =
	/\.(alphanumeric|nonnegative|nonpositive|alpha|email|hex|integer|lowercase|negative|numeric|positive|uppercase|url|uuid)\b/g;
const CONSTRAINT_PATTERN = /\.(min|max|pattern)\s*\(/g;
const BARE_INSTANCEOF = /\binstanceof(?!\s*\()/;

type SchemaIssue =
	| { readonly kind: "bare-instanceof" }
	| { readonly kind: "keyword-order"; readonly constraint: string; readonly basis: string };

interface ArkBindings {
	readonly typeLocals: ReadonlySet<string>;
	readonly namespaceLocals: ReadonlySet<string>;
}

const bindingsByFile = new WeakMap<ts.SourceFile, ArkBindings>();

export const arktypeSchemaStringsRule: ASTRule = {
	name: "arktype-schema-strings",
	description:
		"ArkType schema strings use instanceof() and put format keywords before min, max, and pattern.",
	severity: "error",
	visit(context: RuleContext, node: ts.Node): void {
		if (!ts.isCallExpression(node)) {
			return;
		}
		reportArkCall(context, node);
	},
};

function reportArkCall(context: RuleContext, call: ts.CallExpression): void {
	const bindings = ensureBindings(context.sourceFile);
	if (!isArkTypeCall(call, bindings)) {
		return;
	}
	for (const schema of schemaStrings(call)) {
		for (const issue of schemaIssues(schema.text)) {
			createViolation(context, schema, messageFor(issue));
		}
	}
}

function isArkTypeCall(call: ts.CallExpression, bindings: ArkBindings): boolean {
	const expr = call.expression;
	if (ts.isIdentifier(expr)) {
		return bindings.typeLocals.has(expr.text);
	}
	if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
		return expr.name.text === TYPE_EXPORT && bindings.namespaceLocals.has(expr.expression.text);
	}
	return false;
}

function schemaStrings(call: ts.CallExpression): ts.StringLiteralLike[] {
	const found: ts.StringLiteralLike[] = [];
	for (const arg of call.arguments) {
		collectSchemaStrings(arg, found);
	}
	return found;
}

function collectSchemaStrings(node: ts.Node, found: ts.StringLiteralLike[]): void {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		found.push(node);
		return;
	}
	if (skipSchemaChild(node)) {
		return;
	}
	ts.forEachChild(node, (child) => {
		collectSchemaStrings(child, found);
	});
}

function skipSchemaChild(node: ts.Node): boolean {
	return ts.isCallExpression(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function schemaIssues(text: string): SchemaIssue[] {
	const issues: SchemaIssue[] = [];
	if (BARE_INSTANCEOF.test(text)) {
		issues.push({ kind: "bare-instanceof" });
	}
	const order = keywordOrder(text);
	if (order !== undefined) {
		issues.push({ kind: "keyword-order", constraint: order.constraint, basis: order.basis });
	}
	return issues;
}

function keywordOrder(text: string): { constraint: string; basis: string } | undefined {
	const constraint = firstConstraint(text);
	if (constraint === undefined) {
		return undefined;
	}
	const basis = basisAfter(text, constraint.index);
	if (basis === undefined) {
		return undefined;
	}
	return { constraint: constraint.name, basis };
}

function firstConstraint(text: string): { name: string; index: number } | undefined {
	const first = [...text.matchAll(new RegExp(CONSTRAINT_PATTERN.source, "g"))][0];
	const name = first?.[1];
	if (first?.index === undefined || name === undefined) {
		return undefined;
	}
	return { name, index: first.index };
}

function basisAfter(text: string, index: number): string | undefined {
	for (const match of text.matchAll(new RegExp(BASIS_PATTERN.source, "g"))) {
		const name = match[1];
		if (match.index !== undefined && match.index > index && name !== undefined) {
			return name;
		}
	}
	return undefined;
}

function messageFor(issue: SchemaIssue): string {
	switch (issue.kind) {
		case "bare-instanceof":
			return "ArkType instanceof needs parentheses. Write instanceof(Class).";
		case "keyword-order":
			return `ArkType keyword ${issue.basis} comes after ${issue.constraint}. Put ${issue.basis} first.`;
		default: {
			const _exhaustive: never = issue;
			return _exhaustive;
		}
	}
}

function ensureBindings(sourceFile: ts.SourceFile): ArkBindings {
	const cached = bindingsByFile.get(sourceFile);
	if (cached !== undefined) {
		return cached;
	}
	const bindings = collectBindings(sourceFile);
	bindingsByFile.set(sourceFile, bindings);
	return bindings;
}

function collectBindings(sourceFile: ts.SourceFile): ArkBindings {
	const typeLocals = new Set<string>();
	const namespaceLocals = new Set<string>();
	for (const stmt of sourceFile.statements) {
		if (ts.isImportDeclaration(stmt)) {
			recordImport(stmt, typeLocals, namespaceLocals);
		}
	}
	return { typeLocals, namespaceLocals };
}

function recordImport(
	stmt: ts.ImportDeclaration,
	typeLocals: Set<string>,
	namespaceLocals: Set<string>,
): void {
	if (
		!ts.isStringLiteral(stmt.moduleSpecifier) ||
		stmt.moduleSpecifier.text !== ARKTYPE_SPECIFIER
	) {
		return;
	}
	const clause = stmt.importClause;
	if (clause === undefined || clause.isTypeOnly || clause.namedBindings === undefined) {
		return;
	}
	if (ts.isNamespaceImport(clause.namedBindings)) {
		namespaceLocals.add(clause.namedBindings.name.text);
		return;
	}
	for (const spec of clause.namedBindings.elements) {
		recordNamedType(spec, typeLocals);
	}
}

function recordNamedType(spec: ts.ImportSpecifier, typeLocals: Set<string>): void {
	if (spec.isTypeOnly) {
		return;
	}
	const imported = (spec.propertyName ?? spec.name).text;
	if (imported === TYPE_EXPORT) {
		typeLocals.add(spec.name.text);
	}
}
