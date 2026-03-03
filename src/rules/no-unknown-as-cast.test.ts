import { describe, expect, it } from "bun:test";
import { noUnknownAsCastRule } from "./no-unknown-as-cast.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-unknown-as-cast rule", () => {
	it("should detect double casting through unknown", () => {
		const analyzer = createTestSourceFile(`
			const x = something as unknown as string;
			const y = value as unknown as number;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag direct casting", () => {
		const analyzer = createTestSourceFile(`
			const x = something as string;
			const y = value as number;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});

	it("should detect three or more double casts in one file", () => {
		const analyzer = createTestSourceFile(`
			const a = x as unknown as string;
			const b = y as unknown as number;
			const c = z as unknown as boolean;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should detect double cast inside a nested function body", () => {
		const analyzer = createTestSourceFile(`
			function convert(val: unknown) {
				function inner() {
					return val as unknown as string;
				}
				return inner();
			}
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag a single cast to unknown without a second cast", () => {
		const analyzer = createTestSourceFile(`
			const a = something as unknown;
			const b = value as unknown;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
