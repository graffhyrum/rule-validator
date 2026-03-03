import { describe, expect, it } from "bun:test";
import ts from "typescript";
import { assertDefined } from "../assertions";
import { createVisitor, getAllDescendants } from "./compiler";

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
});
