import { describe, expect, it } from "bun:test";
import { runRules } from "./runner.js";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-waitForTimeout rule", () => {
	it("should detect waitForTimeout calls", () => {
		const analyzer = createTestSourceFile(`
			await page.waitForTimeout(1000);
			someObject.waitForTimeout(500);
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should not flag other method calls", () => {
		const analyzer = createTestSourceFile(`
			await page.waitForSelector('.btn');
			await page.click('.btn');
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
