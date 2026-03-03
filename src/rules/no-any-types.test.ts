import { describe, expect, it } from "bun:test";
import { noAnyTypesRule } from "./no-any-types.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-any-types rule", () => {
	it("severity is pinned to warning", () => {
		expect(noAnyTypesRule.severity).toBe("warning");
	});

	it("should detect any type usage", () => {
		const analyzer = createTestSourceFile(`
			function test(x: any) {
				return x;
			}
			const y: any = 42;
		`);
		const results = runRules({ analyzer, rules: [noAnyTypesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag valid types", () => {
		const analyzer = createTestSourceFile(`
			function test(x: string, y: number) {
				return { x, y };
			}
		`);
		const results = runRules({ analyzer, rules: [noAnyTypesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
