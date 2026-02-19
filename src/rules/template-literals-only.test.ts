import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";

describe("template-literals-only rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect string concatenation", async () => {
		const analyzer = await createTestAnalyzer(`
			const name = "world";
			const greeting = "Hello " + name;
			const full = greeting + "!";
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag template literals", async () => {
		const analyzer = await createTestAnalyzer(`
			const name = "world";
			const greeting = \`Hello \${name}\`;
		`);
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
