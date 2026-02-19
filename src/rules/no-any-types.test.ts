import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noAnyTypesRule } from "./no-any-types.js";

describe("no-any-types rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect any type usage", async () => {
		const analyzer = await createTestAnalyzer(`
			function test(x: any) {
				return x;
			}
			const y: any = 42;
		`);
		const results = runRules({ analyzer, rules: [noAnyTypesRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag valid types", async () => {
		const analyzer = await createTestAnalyzer(`
			function test(x: string, y: number) {
				return { x, y };
			}
		`);
		const results = runRules({ analyzer, rules: [noAnyTypesRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
