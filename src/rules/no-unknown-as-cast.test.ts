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
});
