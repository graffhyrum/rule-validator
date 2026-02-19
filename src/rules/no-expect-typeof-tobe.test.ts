import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";

describe("no-expect-typeof-tobe rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect expect(typeof x).toBe() calls", async () => {
		const analyzer = await createTestAnalyzer(`
			expect(typeof x).toBe('string');
			expect(typeof result).toBe('number');
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other expect calls", async () => {
		const analyzer = await createTestAnalyzer(`
			expect(x).toBe('string');
			expect(result).toBeGreaterThan(0);
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
