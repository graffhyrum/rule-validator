import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";

describe("no-waitForTimeout rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect waitForTimeout calls", async () => {
		const analyzer = await createTestAnalyzer(`
			await page.waitForTimeout(1000);
			someObject.waitForTimeout(500);
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other method calls", async () => {
		const analyzer = await createTestAnalyzer(`
			await page.waitForSelector('.btn');
			await page.click('.btn');
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
