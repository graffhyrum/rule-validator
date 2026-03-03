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

	it("should detect multiple toBeInstanceOf calls in one file", () => {
		const analyzer = createTestSourceFile(`
			expect(a).toBeInstanceOf(Error);
			expect(b).toBeInstanceOf(Map);
			expect(c).toBeInstanceOf(Set);
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should detect toBeInstanceOf inside a nested arrow function", () => {
		const analyzer = createTestSourceFile(`
			const verify = () => {
				expect(result).toBeInstanceOf(Date);
			};
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag expect(x).not.toBeInstanceOf() since it chains through .not", () => {
		const analyzer = createTestSourceFile(`
			expect(x).not.toBeInstanceOf(Error);
			expect(result).toHaveBeenCalledWith(expect.any(Object));
		`);
		const results = runRules({ analyzer, rules: [noToBeInstanceOfRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
