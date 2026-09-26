import * as ts from "typescript";
import { fsModuleKind, isFsModuleSpecifier, type FsModuleKind } from "./fs-module-specifiers.js";
import { isReplaceableFsSymbol, type ReplaceableFsSymbol } from "./replaceable-fs-symbols.js";
/** Bindings are collected once per SourceFile on first ensureBindings call. */
export interface FileBindings {
	moduleLocals: ReadonlyMap<string, FsModuleKind>;
	namedLocals: ReadonlyMap<string, ReplaceableFsSymbol>;
	promisesAliases: ReadonlySet<string>;
}
export type ResolvedFsCall = {
	symbol: ReplaceableFsSymbol;
	reportNode: ts.CallExpression;
};
interface BindingCollector {
	moduleLocals: Map<string, FsModuleKind>;
	namedLocals: Map<string, ReplaceableFsSymbol>;
	promisesAliases: Set<string>;
}
const bindingsBySourceFile = new WeakMap<ts.SourceFile, FileBindings>();
export function resolveFsCall(
	call: ts.CallExpression,
	bindings: FileBindings,
): ResolvedFsCall | undefined {
	const expr = call.expression;
	if (ts.isIdentifier(expr)) {
		return resolveNamedLocalCall(call, expr.text, bindings);
	}
	if (ts.isPropertyAccessExpression(expr)) {
		return resolvePropertyAccessCall(call, expr, bindings);
	}
	return undefined;
}
function resolvePropertyAccessCall(
	call: ts.CallExpression,
	expr: ts.PropertyAccessExpression,
	bindings: FileBindings,
): ResolvedFsCall | undefined {
	const propName = expr.name.text;
	if (isReplaceableFsSymbol(propName)) {
		const inlineRequire = resolveInlineRequireCallee(expr.expression);
		if (inlineRequire !== undefined) {
			return { symbol: propName, reportNode: call };
		}
		if (ts.isIdentifier(expr.expression)) {
			const root = expr.expression.text;
			if (bindings.moduleLocals.has(root) || bindings.promisesAliases.has(root)) {
				return { symbol: propName, reportNode: call };
			}
		}
		if (ts.isPropertyAccessExpression(expr.expression)) {
			const mid = expr.expression;
			if (mid.name.text === "promises" && ts.isIdentifier(mid.expression)) {
				const root = mid.expression.text;
				const kind = bindings.moduleLocals.get(root);
				if (kind === "fs") {
					return { symbol: propName, reportNode: call };
				}
			}
			const inlinePromises = resolveInlineRequirePromises(mid);
			if (inlinePromises && isReplaceableFsSymbol(propName)) {
				return { symbol: propName, reportNode: call };
			}
		}
	}
	return undefined;
}
function resolveInlineRequirePromises(mid: ts.PropertyAccessExpression): boolean {
	if (mid.name.text !== "promises") {
		return false;
	}
	const kind = resolveInlineRequireCallee(mid.expression);
	return kind === "fs";
}
function resolveInlineRequireCallee(expr: ts.Expression): FsModuleKind | undefined {
	const spec = requireModuleSpecifier(expr);
	if (spec === undefined || !isFsModuleSpecifier(spec)) {
		return undefined;
	}
	return fsModuleKind(spec);
}
export function ensureBindings(sourceFile: ts.SourceFile): FileBindings {
	const cached = bindingsBySourceFile.get(sourceFile);
	if (cached !== undefined) {
		return cached;
	}
	const bindings = collectBindings(sourceFile);
	bindingsBySourceFile.set(sourceFile, bindings);
	return bindings;
}
export function collectBindings(sourceFile: ts.SourceFile): FileBindings {
	const collector: BindingCollector = {
		moduleLocals: new Map(),
		namedLocals: new Map(),
		promisesAliases: new Set(),
	};
	collectImportBindings(sourceFile, collector);
	collectRequireBindings(sourceFile, collector);
	collectImportEqualsBindings(sourceFile, collector);
	return {
		moduleLocals: collector.moduleLocals,
		namedLocals: collector.namedLocals,
		promisesAliases: collector.promisesAliases,
	};
}
function collectRequireBindings(sourceFile: ts.SourceFile, collector: BindingCollector): void {
	function visit(node: ts.Node): void {
		if (ts.isVariableDeclaration(node)) {
			recordRequireVariable(node, collector);
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
}
function recordRequireVariable(decl: ts.VariableDeclaration, collector: BindingCollector): void {
	const init = decl.initializer;
	if (init === undefined) {
		return;
	}
	const requireSpec = requireModuleSpecifier(init);
	if (requireSpec === undefined || !isFsModuleSpecifier(requireSpec)) {
		return;
	}
	const kind = fsModuleKind(requireSpec);
	if (ts.isIdentifier(decl.name)) {
		collector.moduleLocals.set(decl.name.text, kind);
		return;
	}
	if (!ts.isObjectBindingPattern(decl.name)) {
		return;
	}
	for (const element of decl.name.elements) {
		recordRequireBindingElement(element, kind, collector);
	}
}
function recordRequireBindingElement(
	element: ts.BindingElement,
	kind: FsModuleKind,
	collector: BindingCollector,
): void {
	const exportName = bindingExportName(element);
	const localName = bindingLocalName(element);
	if (exportName === undefined || localName === undefined) {
		return;
	}
	if (exportName === "default") {
		collector.moduleLocals.set(localName, kind);
		return;
	}
	if (isPromisesImportName(exportName) && kind === "fs") {
		collector.promisesAliases.add(localName);
		collector.moduleLocals.set(localName, "fs-promises");
		return;
	}
	if (isReplaceableFsSymbol(exportName)) {
		collector.namedLocals.set(localName, exportName);
	}
}
function collectImportBindings(sourceFile: ts.SourceFile, collector: BindingCollector): void {
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)) {
			continue;
		}
		const moduleText = moduleSpecifierText(statement.moduleSpecifier);
		if (moduleText === undefined || !isFsModuleSpecifier(moduleText)) {
			continue;
		}
		const kind = fsModuleKind(moduleText);
		const clause = statement.importClause;
		if (clause === undefined || clause.isTypeOnly) {
			continue;
		}
		if (clause.name !== undefined) {
			collector.moduleLocals.set(clause.name.text, kind);
		}
		const named = clause.namedBindings;
		if (named === undefined) {
			continue;
		}
		if (ts.isNamespaceImport(named)) {
			collector.moduleLocals.set(named.name.text, kind);
			continue;
		}
		if (ts.isNamedImports(named)) {
			for (const spec of named.elements) {
				recordNamedImport(spec, kind, collector);
			}
		}
	}
}
function recordNamedImport(
	spec: ts.ImportSpecifier,
	kind: FsModuleKind,
	collector: BindingCollector,
): void {
	if (!isValueImportSpecifier(spec)) {
		return;
	}
	const exportName = bindingExportName(spec);
	const localName = bindingLocalName(spec);
	if (exportName === undefined || localName === undefined) {
		return;
	}
	if (isPromisesImportName(exportName) && kind === "fs") {
		collector.promisesAliases.add(localName);
		collector.moduleLocals.set(localName, "fs-promises");
		return;
	}
	if (isReplaceableFsSymbol(exportName)) {
		collector.namedLocals.set(localName, exportName);
	}
}
function isValueImportSpecifier(spec: ts.ImportSpecifier): boolean {
	if (spec.isTypeOnly) {
		return false;
	}
	const clause = findImportClause(spec);
	return clause !== undefined && !clause.isTypeOnly;
}
function bindingLocalName(node: ts.ImportSpecifier | ts.BindingElement): string | undefined {
	return identifierOrStringText(node.name);
}
function bindingExportName(node: ts.ImportSpecifier | ts.BindingElement): string | undefined {
	const nameNode = node.propertyName ?? node.name;
	return identifierOrStringText(nameNode);
}
function isPromisesImportName(exportName: string): boolean {
	return exportName === "promises";
}
function collectImportEqualsBindings(sourceFile: ts.SourceFile, collector: BindingCollector): void {
	for (const statement of sourceFile.statements) {
		if (!ts.isImportEqualsDeclaration(statement)) {
			continue;
		}
		if (statement.isTypeOnly) {
			continue;
		}
		const ref = statement.moduleReference;
		if (!ts.isExternalModuleReference(ref) || ref.expression === undefined) {
			continue;
		}
		if (!ts.isStringLiteral(ref.expression)) {
			continue;
		}
		const text = ref.expression.text;
		if (!isFsModuleSpecifier(text)) {
			continue;
		}
		collector.moduleLocals.set(statement.name.text, fsModuleKind(text));
	}
}
function resolveNamedLocalCall(
	call: ts.CallExpression,
	localName: string,
	bindings: FileBindings,
): ResolvedFsCall | undefined {
	const symbol = bindings.namedLocals.get(localName);
	if (symbol === undefined) {
		return undefined;
	}
	return { symbol, reportNode: call };
}
function requireModuleSpecifier(expr: ts.Expression): string | undefined {
	if (!ts.isCallExpression(expr)) {
		return undefined;
	}
	if (!ts.isIdentifier(expr.expression) || expr.expression.text !== "require") {
		return undefined;
	}
	const arg = expr.arguments[0];
	if (arg === undefined || !ts.isStringLiteral(arg)) {
		return undefined;
	}
	return arg.text;
}
function moduleSpecifierText(spec: ts.Expression): string | undefined {
	if (ts.isStringLiteral(spec)) {
		return spec.text;
	}
	return undefined;
}
function findImportClause(spec: ts.ImportSpecifier): ts.ImportClause | undefined {
	let current: ts.Node | undefined = spec.parent;
	while (current !== undefined) {
		if (ts.isImportClause(current)) {
			return current;
		}
		current = current.parent;
	}
	return undefined;
}
function identifierOrStringText(node: ts.Node): string | undefined {
	if (ts.isIdentifier(node)) {
		return node.text;
	}
	if (ts.isStringLiteral(node)) {
		return node.text;
	}
	return undefined;
}
