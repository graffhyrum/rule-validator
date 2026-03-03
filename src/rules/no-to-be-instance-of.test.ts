import { describe, expect, it } from "bun:test";
import { noToBeInstanceOfRule } from "./no-to-be-instance-of.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-toBeInstanceOf rule", () => {
	it("should detect expect(x).toBeInstanceOf() calls", () => {
		const analyzer = createTestSourceFile(`
			expect(x).toBeInstanceOf(String);
			expect(result).toBeInstanceOf(Array);
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other expect calls", () => {
		const analyzer = createTestSourceFile(`
			expect(x).toBe('string');
			expect(result).toHaveLength(5);
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
