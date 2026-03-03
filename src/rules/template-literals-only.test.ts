import { describe, expect, it } from "bun:test";
import { runRules } from "./runner.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("template-literals-only rule", () => {
	it("should detect string concatenation", () => {
		const analyzer = createTestSourceFile(`
			const name = "world";
			const greeting = "Hello " + name;
			const full = greeting + "!";
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag template literals", () => {
		const analyzer = createTestSourceFile(`
			const name = "world";
			const greeting = \`Hello \${name}\`;
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});

	it("should detect multiple string concatenations in one file", () => {
		const analyzer = createTestSourceFile(`
			const a = "foo" + bar;
			const b = "hello" + " world";
			const c = baz + "!";
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should detect string concatenation inside a nested function body", () => {
		const analyzer = createTestSourceFile(`
			function buildMessage(name: string): string {
				return "Hello " + name;
			}
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag numeric addition with the plus operator", () => {
		const analyzer = createTestSourceFile(`
			const sum = 1 + 2;
			const total = count + offset;
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
