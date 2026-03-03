import { describe, expect, it } from "bun:test";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-non-null-assertion rule", () => {
	it("should detect non-null assertions", () => {
		const analyzer = createTestSourceFile(`
			const x = value!;
			const y = obj!.property;
			const z = arr[0]!.method();
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should not flag optional chaining", () => {
		const analyzer = createTestSourceFile(`
			const x = value?.property;
			const y = obj?.method();
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
