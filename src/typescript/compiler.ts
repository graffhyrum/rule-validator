import path from "node:path";
import { glob } from "glob";
import * as ts from "typescript";
import { ALWAYS_EXCLUDE } from "../exclude-patterns.ts";
import { toPosixPath } from "../paths.ts";
export function getNodeLocation(sourceFile: ts.SourceFile, node: ts.Node): NodeLocation {
	const start = getLineAndColumn(sourceFile, node.getStart());
	const end = getLineAndColumn(sourceFile, node.getEnd());
	return {
		file: sourceFile.fileName,
		line: start.line,
		column: start.column,
		endLine: end.line,
		endColumn: end.column,
	};
}
export function traverseSourceFile<T>(
	sourceFile: ts.SourceFile,
	visitor: (node: ts.Node, context: T) => void,
	context: T,
): void {
	function visit(node: ts.Node): void {
		visitor(node, context);
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
}
const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

export interface AnalyzerDeps {
	listFiles: (pattern: string, excludePatterns: readonly string[]) => Promise<string[]>;
	readFile: (absolutePath: string) => Promise<string>;
}

export interface AnalyzerConfig {
	pattern: string;
	excludePatterns?: string[];
}

export interface AnalyzerContext {
	sourceFiles: Map<string, ts.SourceFile>;
}

export async function createAnalyzer(
	config: AnalyzerConfig,
	deps: AnalyzerDeps = defaultAnalyzerDeps,
): Promise<AnalyzerContext> {
	const files = await deps.listFiles(config.pattern, config.excludePatterns ?? []);
	const sourceFiles = await parseSourceFiles(files, deps.readFile);
	return { sourceFiles };
}

export const defaultAnalyzerDeps: AnalyzerDeps = {
	listFiles: listTsFiles,
	readFile: (absolutePath) => Bun.file(absolutePath).text(),
};

async function parseSourceFiles(
	paths: readonly string[],
	readFile: AnalyzerDeps["readFile"],
): Promise<Map<string, ts.SourceFile>> {
	const sourceFiles = new Map<string, ts.SourceFile>();
	for (const filePath of paths) {
		const normalized = toPosixPath(path.resolve(filePath));
		const content = await readFile(normalized);
		sourceFiles.set(
			normalized,
			ts.createSourceFile(normalized, content, ts.ScriptTarget.Latest, true),
		);
	}
	return sourceFiles;
}

async function listTsFiles(pattern: string, excludePatterns: readonly string[]): Promise<string[]> {
	const allExcludes: string[] = [...ALWAYS_EXCLUDE, ...excludePatterns];
	const files: string[] = await glob(pattern, { absolute: true, ignore: allExcludes });
	return files.filter((f: string) => TS_EXTENSIONS.some((ext: string) => f.endsWith(ext)));
}

export function getLineAndColumn(
	sourceFile: ts.SourceFile,
	pos: number,
): {
	line: number;
	column: number;
} {
	const lineStart: { line: number; character: number } =
		sourceFile.getLineAndCharacterOfPosition(pos);
	return { line: lineStart.line + 1, column: lineStart.character + 1 };
}
export function getNodeText(sourceFile: ts.SourceFile, node: ts.Node): string {
	return node.getText(sourceFile);
}
export const is = {
	identifier: isIdentifier,
	variableDeclaration: isVariableDeclaration,
	functionDeclaration: isFunctionDeclaration,
	classDeclaration: isClassDeclaration,
	constructorDeclaration: isConstructorDeclaration,
	interfaceDeclaration: isInterfaceDeclaration,
	typeAliasDeclaration: isTypeAliasDeclaration,
	typeReference: isTypeReference,
	callExpression: isCallExpression,
	binaryExpression: isBinaryExpression,
	propertyAccessExpression: isPropertyAccessExpression,
	stringLiteral: isStringLiteral,
	templateExpression: isTemplateExpression,
	importDeclaration: isImportDeclaration,
	exportDeclaration: isExportDeclaration,
	methodDeclaration: isMethodDeclaration,
	getAccessor: isGetAccessor,
	setAccessor: isSetAccessor,
	propertyDeclaration: isPropertyDeclaration,
	parameter: isParameter,
	asExpression: isAsExpression,
	anyKeyword: (node: ts.Node): boolean => node.kind === ts.SyntaxKind.AnyKeyword,
	typeOfExpression: isTypeOfExpression,
	unknownKeyword: (node: ts.Node): boolean => node.kind === ts.SyntaxKind.UnknownKeyword,
	nonNullExpression: isNonNullExpression,
};

function isIdentifier(node: ts.Node): node is ts.Identifier {
	return ts.isIdentifier(node);
}
function isVariableDeclaration(node: ts.Node): node is ts.VariableDeclaration {
	return ts.isVariableDeclaration(node);
}
function isFunctionDeclaration(node: ts.Node): node is ts.FunctionDeclaration {
	return ts.isFunctionDeclaration(node);
}
function isClassDeclaration(node: ts.Node): node is ts.ClassDeclaration {
	return ts.isClassDeclaration(node);
}
function isConstructorDeclaration(node: ts.Node): node is ts.ConstructorDeclaration {
	return ts.isConstructorDeclaration(node);
}
function isInterfaceDeclaration(node: ts.Node): node is ts.InterfaceDeclaration {
	return ts.isInterfaceDeclaration(node);
}
function isTypeAliasDeclaration(node: ts.Node): node is ts.TypeAliasDeclaration {
	return ts.isTypeAliasDeclaration(node);
}
function isTypeReference(node: ts.Node): node is ts.TypeReferenceNode {
	return ts.isTypeReferenceNode(node);
}
function isCallExpression(node: ts.Node): node is ts.CallExpression {
	return ts.isCallExpression(node);
}
function isBinaryExpression(node: ts.Node): node is ts.BinaryExpression {
	return ts.isBinaryExpression(node);
}
function isPropertyAccessExpression(node: ts.Node): node is ts.PropertyAccessExpression {
	return ts.isPropertyAccessExpression(node);
}
function isStringLiteral(node: ts.Node): node is ts.StringLiteral {
	return ts.isStringLiteral(node);
}
function isTemplateExpression(node: ts.Node): node is ts.TemplateExpression {
	return ts.isTemplateExpression(node);
}
function isImportDeclaration(node: ts.Node): node is ts.ImportDeclaration {
	return ts.isImportDeclaration(node);
}
function isExportDeclaration(node: ts.Node): node is ts.ExportDeclaration {
	return ts.isExportDeclaration(node);
}
function isMethodDeclaration(node: ts.Node): node is ts.MethodDeclaration {
	return ts.isMethodDeclaration(node);
}
function isGetAccessor(node: ts.Node): node is ts.GetAccessorDeclaration {
	return ts.isGetAccessor(node);
}
function isSetAccessor(node: ts.Node): node is ts.SetAccessorDeclaration {
	return ts.isSetAccessor(node);
}
function isPropertyDeclaration(node: ts.Node): node is ts.PropertyDeclaration {
	return ts.isPropertyDeclaration(node);
}
function isParameter(node: ts.Node): node is ts.ParameterDeclaration {
	return ts.isParameter(node);
}
function isAsExpression(node: ts.Node): node is ts.AsExpression {
	return ts.isAsExpression(node);
}
function isTypeOfExpression(node: ts.Node): node is ts.TypeOfExpression {
	return node.kind === ts.SyntaxKind.TypeOfExpression;
}
function isNonNullExpression(node: ts.Node): node is ts.NonNullExpression {
	return ts.isNonNullExpression(node);
}
export interface NodeLocation {
	file: string;
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
}
