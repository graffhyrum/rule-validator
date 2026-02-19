import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noToBeInstanceOfRule } from "./no-to-be-instance-of.js";

describe("no-toBeInstanceOf rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect expect(x).toBeInstanceOf() calls", async () => {
		const analyzer = await createTestAnalyzer(`
			expect(x).toBeInstanceOf(String);
			expect(result).toBeInstanceOf(Array);
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other expect calls", async () => {
		const analyzer = await createTestAnalyzer(`
			expect(x).toBe('string');
			expect(result).toHaveLength(5);
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
