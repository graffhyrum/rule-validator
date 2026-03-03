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
});
