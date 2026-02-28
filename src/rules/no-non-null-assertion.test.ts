import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";

describe("no-non-null-assertion rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect non-null assertions", async () => {
		const analyzer = await createTestAnalyzer(`
			const x = value!;
			const y = obj!.property;
			const z = arr[0]!.method();
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should not flag optional chaining", async () => {
		const analyzer = await createTestAnalyzer(`
			const x = value?.property;
			const y = obj?.method();
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
