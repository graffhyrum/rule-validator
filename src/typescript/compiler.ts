import path from "node:path";
import * as ts from "typescript";
export function getAllDescendants(node: ts.Node): ts.Node[] {
	const descendants: ts.Node[] = [];
	function visit(n: ts.Node): void {
		descendants.push(n);
		ts.forEachChild(n, visit);
	}
	visit(node);
	return descendants;
}
export function createVisitor<T>(options: VisitorOptions<T>): (node: ts.Node, ctx: T) => void {
	return (node: ts.Node, ctx: T) => {
		options.enter?.(node, ctx);
		ts.forEachChild(node, (child) => {
			options.enter?.(child, ctx);
			function visit(n: ts.Node): void {
				options.enter?.(n, ctx);
				ts.forEachChild(n, visit);
				options.leave?.(n, ctx);
			}
			visit(child);
			options.leave?.(child, ctx);
		});
		options.leave?.(node, ctx);
	};
}
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
export async function createAnalyzer(config: AnalyzerConfig): Promise<AnalyzerContext> {
	const tsconfigPath = config.tsconfigPath ?? "./tsconfig.json";
	const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	if (configFile.error) {
		throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
	}
	const parsedConfig = ts.parseJsonConfigFileContent(
		configFile.config,
		ts.sys,
		path.dirname(tsconfigPath),
	);
	const files = await getFilesMatchingPattern(config.pattern, config.excludePatterns);
	const program = ts.createProgram({
		rootNames: files,
		options: parsedConfig.options,
	});
	const checker = program.getTypeChecker();
	const sourceFiles = new Map<string, ts.SourceFile>();
	for (const file of program.getSourceFiles()) {
		sourceFiles.set(file.fileName, file);
	}
	return { program, checker, sourceFiles };
}
async function getFilesMatchingPattern(
	pattern: string,
	excludePatterns: string[] = [],
): Promise<string[]> {
	const { glob } = await import("glob");
	const defaultExcludes = ["node_modules/**", "**/node_modules/**", "dist/**", "build/**"];
	const allExcludes = [...defaultExcludes, ...excludePatterns];
	const files = await glob(pattern, { absolute: true });
	const excludeRegexes = allExcludes.map((ex) => {
		const escaped = ex.replace(/[.+^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`^${escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")}$`);
	});
	return files.filter((f) => {
		const shouldExclude = excludeRegexes.some((regex) => regex.test(f));
		if (shouldExclude) return false;
		return [".ts", ".tsx", ".mts", ".cts"].some((ext) => f.endsWith(ext));
	});
}
export function getLineAndColumn(
	sourceFile: ts.SourceFile,
	pos: number,
): {
	line: number;
	column: number;
} {
	const lineStart = sourceFile.getLineAndCharacterOfPosition(pos);
	return { line: lineStart.line + 1, column: lineStart.character + 1 };
}
export function getNodeText(sourceFile: ts.SourceFile, node: ts.Node): string {
	return node.getText(sourceFile);
}
export function findAncestor<T extends ts.Node>(
	node: ts.Node,
	predicate: (n: ts.Node) => n is T,
): T | undefined {
	let current: ts.Node | undefined = node.parent;
	while (current) {
		if (predicate(current)) {
			return current;
		}
		current = current.parent;
	}
	return undefined;
}
export interface AnalyzerConfig {
	pattern: string;
	excludePatterns?: string[];
	tsconfigPath?: string;
}
export interface AnalyzerContext {
	program: ts.Program;
	checker: ts.TypeChecker;
	sourceFiles: Map<string, ts.SourceFile>;
}
export const is = {
	identifier: (node: ts.Node): node is ts.Identifier => ts.isIdentifier(node),
	variableDeclaration: (node: ts.Node): node is ts.VariableDeclaration =>
		ts.isVariableDeclaration(node),
	functionDeclaration: (node: ts.Node): node is ts.FunctionDeclaration =>
		ts.isFunctionDeclaration(node),
	classDeclaration: (node: ts.Node): node is ts.ClassDeclaration => ts.isClassDeclaration(node),
	interfaceDeclaration: (node: ts.Node): node is ts.InterfaceDeclaration =>
		ts.isInterfaceDeclaration(node),
	typeAliasDeclaration: (node: ts.Node): node is ts.TypeAliasDeclaration =>
		ts.isTypeAliasDeclaration(node),
	typeReference: (node: ts.Node): node is ts.TypeReferenceNode => ts.isTypeReferenceNode(node),
	callExpression: (node: ts.Node): node is ts.CallExpression => ts.isCallExpression(node),
	binaryExpression: (node: ts.Node): node is ts.BinaryExpression => ts.isBinaryExpression(node),
	propertyAccessExpression: (node: ts.Node): node is ts.PropertyAccessExpression =>
		ts.isPropertyAccessExpression(node),
	stringLiteral: (node: ts.Node): node is ts.StringLiteral => ts.isStringLiteral(node),
	templateExpression: (node: ts.Node): node is ts.TemplateExpression =>
		ts.isTemplateExpression(node),
	importDeclaration: (node: ts.Node): node is ts.ImportDeclaration => ts.isImportDeclaration(node),
	exportDeclaration: (node: ts.Node): node is ts.ExportDeclaration => ts.isExportDeclaration(node),
	methodDeclaration: (node: ts.Node): node is ts.MethodDeclaration => ts.isMethodDeclaration(node),
	getAccessor: (node: ts.Node): node is ts.GetAccessorDeclaration => ts.isGetAccessor(node),
	setAccessor: (node: ts.Node): node is ts.SetAccessorDeclaration => ts.isSetAccessor(node),
	propertyDeclaration: (node: ts.Node): node is ts.PropertyDeclaration =>
		ts.isPropertyDeclaration(node),
	parameter: (node: ts.Node): node is ts.ParameterDeclaration => ts.isParameter(node),
	asExpression: (node: ts.Node): node is ts.AsExpression => ts.isAsExpression(node),
	anyKeyword: (node: ts.Node): boolean => node.kind === ts.SyntaxKind.AnyKeyword,
	typeOfExpression: (node: ts.Node): node is ts.TypeOfExpression =>
		node.kind === ts.SyntaxKind.TypeOfExpression,
	unknownKeyword: (node: ts.Node): boolean => node.kind === ts.SyntaxKind.UnknownKeyword,
};
export interface NodeLocation {
	file: string;
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
}
export interface VisitorOptions<T> {
	context: T;
	enter?: (node: ts.Node, ctx: T) => void;
	leave?: (node: ts.Node, ctx: T) => void;
}
