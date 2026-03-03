import { describe, expect, it } from "bun:test";
import { runRules } from "./runner.js";
import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-expect-typeof-tobe rule", () => {
	it("should detect expect(typeof x).toBe() calls", () => {
		const analyzer = createTestSourceFile(`
			expect(typeof x).toBe('string');
			expect(typeof result).toBe('number');
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other expect calls", () => {
		const analyzer = createTestSourceFile(`
			expect(x).toBe('string');
			expect(result).toBeGreaterThan(0);
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
