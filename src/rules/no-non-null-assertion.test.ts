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

	it("should detect four or more non-null assertions in one file", () => {
		const analyzer = createTestSourceFile(`
			const a = val1!;
			const b = val2!.name;
			const c = val3!.items[0];
			const d = val4!.result;
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(4);
	});

	it("should detect non-null assertion inside a nested arrow function", () => {
		const analyzer = createTestSourceFile(`
			const process = (items: string[]) => {
				const inner = () => {
					return items[0]!;
				};
				return inner;
			};
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag logical NOT or double negation", () => {
		const analyzer = createTestSourceFile(`
			const isValid = !value;
			const truthy = !!obj;
		`);
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
