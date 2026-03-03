import { describe, expect, it } from "bun:test";
import ts from "typescript";
import { assertDefined } from "../assertions";
import { createVisitor, getAllDescendants, is } from "./compiler";

describe("compiler", () => {
	describe("getAllDescendants", () => {
		it("should return all descendants of a node including itself", () => {
			// Create a real source file for testing
			const sourceFile = ts.createSourceFile(
				"test.ts",
				"const x = 1;",
				ts.ScriptTarget.Latest,
				true,
			);

			const statement = sourceFile.statements[0];
			assertDefined(statement);

			const result = getAllDescendants(statement);

			// Should include the statement and its descendants
			expect(result.length).toBeGreaterThan(1);
			expect(result[0]).toBe(statement);
			expect(result).toContain(statement);
		});

		it("should handle node with no children", () => {
			// Create a source file with a simple identifier
			const sourceFile = ts.createSourceFile("test.ts", "x;", ts.ScriptTarget.Latest, true);
			const statement = sourceFile.statements[0];
			assertDefined(statement);

			expect(ts.isExpressionStatement(statement)).toBe(true);

			const expressionStatement = statement as ts.ExpressionStatement;
			const result = getAllDescendants(expressionStatement.expression);

			// Identifier has no children
			expect(result).toEqual([expressionStatement.expression]);
		});
	});

	describe("createVisitor", () => {
		it("should call enter and leave in correct order", () => {
			const sourceFile = ts.createSourceFile(
				"test.ts",
				"const x = 1;",
				ts.ScriptTarget.Latest,
				true,
			);
			const statement = sourceFile.statements[0];
			assertDefined(statement);

			const calls: string[] = [];
			const visitor = createVisitor({
				enter: (node, _ctx) => {
					calls.push(`enter-${node.kind}`);
				},
				leave: (node, _ctx) => {
					calls.push(`leave-${node.kind}`);
				},
			});

			visitor(statement, {});

			expect(calls.length).toBeGreaterThan(2);
			expect(calls[0]).toBe(`enter-${statement.kind}`);
			expect(calls.at(-1)).toBe(`leave-${statement.kind}`);
		});
	});

	describe("is type guards", () => {
		function parse(src: string): ts.SourceFile {
			return ts.createSourceFile("t.ts", src, ts.ScriptTarget.Latest, true);
		}

		function findByKind(sf: ts.SourceFile, kind: ts.SyntaxKind): ts.Node {
			const found = getAllDescendants(sf).find((n) => n.kind === kind);
			assertDefined(found);
			return found;
		}

		function firstStatement(sf: ts.SourceFile): ts.Node {
			const stmt = sf.statements[0];
			assertDefined(stmt);
			return stmt;
		}

		it("identifier: true for Identifier, false for StringLiteral", () => {
			const sf = parse("const x = 1;");
			const ident = findByKind(sf, ts.SyntaxKind.Identifier);
			const str = findByKind(parse('"hello";'), ts.SyntaxKind.StringLiteral);
			expect(is.identifier(ident)).toBe(true);
			expect(is.identifier(str)).toBe(false);
		});

		it("variableDeclaration: true for VariableDeclaration, false for FunctionDeclaration", () => {
			const varDecl = findByKind(parse("const x = 1;"), ts.SyntaxKind.VariableDeclaration);
			const funcDecl = firstStatement(parse("function f() {}"));
			expect(is.variableDeclaration(varDecl)).toBe(true);
			expect(is.variableDeclaration(funcDecl)).toBe(false);
		});

		it("functionDeclaration: true for FunctionDeclaration, false for ClassDeclaration", () => {
			const funcDecl = firstStatement(parse("function f() {}"));
			const classDecl = firstStatement(parse("class Foo {}"));
			expect(is.functionDeclaration(funcDecl)).toBe(true);
			expect(is.functionDeclaration(classDecl)).toBe(false);
		});

		it("classDeclaration: true for ClassDeclaration, false for InterfaceDeclaration", () => {
			const classDecl = firstStatement(parse("class Foo {}"));
			const iface = firstStatement(parse("interface I {}"));
			expect(is.classDeclaration(classDecl)).toBe(true);
			expect(is.classDeclaration(iface)).toBe(false);
		});

		it("constructorDeclaration: true for constructor member, false for MethodDeclaration", () => {
			const classNode = firstStatement(parse("class Foo { constructor() {} m() {} }")) as ts.ClassDeclaration;
			const ctor = classNode.members[0];
			const method = classNode.members[1];
			assertDefined(ctor);
			assertDefined(method);
			expect(is.constructorDeclaration(ctor)).toBe(true);
			expect(is.constructorDeclaration(method)).toBe(false);
		});

		it("interfaceDeclaration: true for InterfaceDeclaration, false for TypeAliasDeclaration", () => {
			const iface = firstStatement(parse("interface I {}"));
			const alias = firstStatement(parse("type T = string;"));
			expect(is.interfaceDeclaration(iface)).toBe(true);
			expect(is.interfaceDeclaration(alias)).toBe(false);
		});

		it("typeAliasDeclaration: true for TypeAliasDeclaration, false for InterfaceDeclaration", () => {
			const alias = firstStatement(parse("type T = string;"));
			const iface = firstStatement(parse("interface I {}"));
			expect(is.typeAliasDeclaration(alias)).toBe(true);
			expect(is.typeAliasDeclaration(iface)).toBe(false);
		});

		it("typeReference: true for TypeReferenceNode, false for StringKeyword", () => {
			const typeRef = findByKind(parse("const x: Foo = null as unknown;"), ts.SyntaxKind.TypeReference);
			const strKw = findByKind(parse("type T = string;"), ts.SyntaxKind.StringKeyword);
			expect(is.typeReference(typeRef)).toBe(true);
			expect(is.typeReference(strKw)).toBe(false);
		});

		it("callExpression: true for CallExpression, false for Identifier", () => {
			const callExpr = findByKind(parse("f();"), ts.SyntaxKind.CallExpression);
			const ident = findByKind(parse("x;"), ts.SyntaxKind.Identifier);
			expect(is.callExpression(callExpr)).toBe(true);
			expect(is.callExpression(ident)).toBe(false);
		});

		it("binaryExpression: true for BinaryExpression, false for CallExpression", () => {
			const binExpr = findByKind(parse("a + b;"), ts.SyntaxKind.BinaryExpression);
			const callExpr = findByKind(parse("f();"), ts.SyntaxKind.CallExpression);
			expect(is.binaryExpression(binExpr)).toBe(true);
			expect(is.binaryExpression(callExpr)).toBe(false);
		});

		it("propertyAccessExpression: true for PropertyAccessExpression, false for Identifier", () => {
			const propAccess = findByKind(parse("a.b;"), ts.SyntaxKind.PropertyAccessExpression);
			const ident = findByKind(parse("x;"), ts.SyntaxKind.Identifier);
			expect(is.propertyAccessExpression(propAccess)).toBe(true);
			expect(is.propertyAccessExpression(ident)).toBe(false);
		});

		it("stringLiteral: true for StringLiteral, false for NumericLiteral", () => {
			const strLit = findByKind(parse('"hello";'), ts.SyntaxKind.StringLiteral);
			const numLit = findByKind(parse("42;"), ts.SyntaxKind.NumericLiteral);
			expect(is.stringLiteral(strLit)).toBe(true);
			expect(is.stringLiteral(numLit)).toBe(false);
		});

		it("templateExpression: true for TemplateExpression, false for StringLiteral", () => {
			const tmplExpr = findByKind(parse("`hello ${x}`;"), ts.SyntaxKind.TemplateExpression);
			const strLit = findByKind(parse('"hello";'), ts.SyntaxKind.StringLiteral);
			expect(is.templateExpression(tmplExpr)).toBe(true);
			expect(is.templateExpression(strLit)).toBe(false);
		});

		it("importDeclaration: true for ImportDeclaration, false for ExportDeclaration", () => {
			const importDecl = firstStatement(parse("import {} from 'x';"));
			const exportDecl = firstStatement(parse("export {};"));
			expect(is.importDeclaration(importDecl)).toBe(true);
			expect(is.importDeclaration(exportDecl)).toBe(false);
		});

		it("exportDeclaration: true for ExportDeclaration, false for ImportDeclaration", () => {
			const exportDecl = firstStatement(parse("export {};"));
			const importDecl = firstStatement(parse("import {} from 'x';"));
			expect(is.exportDeclaration(exportDecl)).toBe(true);
			expect(is.exportDeclaration(importDecl)).toBe(false);
		});

		it("methodDeclaration: true for MethodDeclaration, false for PropertyDeclaration", () => {
			const classNode = firstStatement(parse("class Foo { m() {} p = 1; }")) as ts.ClassDeclaration;
			const method = classNode.members[0];
			const prop = classNode.members[1];
			assertDefined(method);
			assertDefined(prop);
			expect(is.methodDeclaration(method)).toBe(true);
			expect(is.methodDeclaration(prop)).toBe(false);
		});

		it("getAccessor: true for get accessor, false for set accessor", () => {
			const classNode = firstStatement(parse("class Foo { get x() { return 1; } set x(v: number) {} }")) as ts.ClassDeclaration;
			const getter = classNode.members[0];
			const setter = classNode.members[1];
			assertDefined(getter);
			assertDefined(setter);
			expect(is.getAccessor(getter)).toBe(true);
			expect(is.getAccessor(setter)).toBe(false);
		});

		it("setAccessor: true for set accessor, false for get accessor", () => {
			const classNode = firstStatement(parse("class Foo { get x() { return 1; } set x(v: number) {} }")) as ts.ClassDeclaration;
			const getter = classNode.members[0];
			const setter = classNode.members[1];
			assertDefined(getter);
			assertDefined(setter);
			expect(is.setAccessor(setter)).toBe(true);
			expect(is.setAccessor(getter)).toBe(false);
		});

		it("propertyDeclaration: true for PropertyDeclaration, false for MethodDeclaration", () => {
			const classNode = firstStatement(parse("class Foo { p = 1; m() {} }")) as ts.ClassDeclaration;
			const prop = classNode.members[0];
			const method = classNode.members[1];
			assertDefined(prop);
			assertDefined(method);
			expect(is.propertyDeclaration(prop)).toBe(true);
			expect(is.propertyDeclaration(method)).toBe(false);
		});

		it("parameter: true for ParameterDeclaration, false for VariableDeclaration", () => {
			const param = findByKind(parse("function f(x: number) {}"), ts.SyntaxKind.Parameter);
			const varDecl = findByKind(parse("const x = 1;"), ts.SyntaxKind.VariableDeclaration);
			expect(is.parameter(param)).toBe(true);
			expect(is.parameter(varDecl)).toBe(false);
		});

		it("asExpression: true for AsExpression, false for BinaryExpression", () => {
			const asExpr = findByKind(parse("const x = y as string;"), ts.SyntaxKind.AsExpression);
			const binExpr = findByKind(parse("a + b;"), ts.SyntaxKind.BinaryExpression);
			expect(is.asExpression(asExpr)).toBe(true);
			expect(is.asExpression(binExpr)).toBe(false);
		});

		it("anyKeyword: true for AnyKeyword, false for StringKeyword", () => {
			const anyKw = findByKind(parse("const x: any = 1;"), ts.SyntaxKind.AnyKeyword);
			const strKw = findByKind(parse("const x: string = '';"), ts.SyntaxKind.StringKeyword);
			expect(is.anyKeyword(anyKw)).toBe(true);
			expect(is.anyKeyword(strKw)).toBe(false);
		});

		it("typeOfExpression: true for TypeOfExpression, false for BinaryExpression", () => {
			const typeofExpr = findByKind(parse("typeof x;"), ts.SyntaxKind.TypeOfExpression);
			const binExpr = findByKind(parse("a + b;"), ts.SyntaxKind.BinaryExpression);
			expect(is.typeOfExpression(typeofExpr)).toBe(true);
			expect(is.typeOfExpression(binExpr)).toBe(false);
		});

		it("unknownKeyword: true for UnknownKeyword, false for AnyKeyword", () => {
			const unknownKw = findByKind(parse("const x: unknown = 1;"), ts.SyntaxKind.UnknownKeyword);
			const anyKw = findByKind(parse("const x: any = 1;"), ts.SyntaxKind.AnyKeyword);
			expect(is.unknownKeyword(unknownKw)).toBe(true);
			expect(is.unknownKeyword(anyKw)).toBe(false);
		});

		it("nonNullExpression: true for NonNullExpression, false for Identifier", () => {
			const nonNull = findByKind(parse("x!;"), ts.SyntaxKind.NonNullExpression);
			const ident = findByKind(parse("x;"), ts.SyntaxKind.Identifier);
			expect(is.nonNullExpression(nonNull)).toBe(true);
			expect(is.nonNullExpression(ident)).toBe(false);
		});
	});
});
