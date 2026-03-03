import { describe, expect, it } from "bun:test";
import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";
import { runRules } from "./runner.js";
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

	it("should detect multiple expect(typeof x).toBe() calls in one block", () => {
		const analyzer = createTestSourceFile(`
			expect(typeof a).toBe('string');
			expect(typeof b).toBe('number');
			expect(typeof c).toBe('boolean');
			expect(typeof d).toBe('object');
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(4);
	});

	it("should detect expect(typeof x).toBe() inside a nested arrow function", () => {
		const analyzer = createTestSourceFile(`
			const check = () => {
				expect(typeof value).toBe('string');
			};
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag expect(typeof x).not.toBe() since it chains through .not", () => {
		const analyzer = createTestSourceFile(`
			expect(typeof x).not.toBe('string');
			expect(x).toBe(typeof y);
		`);
		const results = runRules({ analyzer, rules: [noExpectTypeofToBeRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
