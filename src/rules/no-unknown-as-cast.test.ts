import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noUnknownAsCastRule } from "./no-unknown-as-cast.js";

describe("no-unknown-as-cast rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect double casting through unknown", async () => {
		const analyzer = await createTestAnalyzer(`
			const x = something as unknown as string;
			const y = value as unknown as number;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag direct casting", async () => {
		const analyzer = await createTestAnalyzer(`
			const x = something as string;
			const y = value as number;
		`);
		const results = runRules({ analyzer, rules: [noUnknownAsCastRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
