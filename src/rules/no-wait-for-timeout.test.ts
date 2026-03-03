import { describe, expect, it } from "bun:test";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";
import { runRules } from "./runner.js";
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

	it("should detect multiple waitForTimeout calls in one file", () => {
		const analyzer = createTestSourceFile(`
			await page.waitForTimeout(500);
			await frame.waitForTimeout(1000);
			await locator.waitForTimeout(250);
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(3);
	});

	it("should detect waitForTimeout inside a nested async arrow function", () => {
		const analyzer = createTestSourceFile(`
			const delay = async () => {
				await page.waitForTimeout(2000);
			};
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag waitFor without the Timeout suffix", () => {
		const analyzer = createTestSourceFile(`
			await page.waitFor({ state: 'visible' });
			const waitForTimeout = 1000;
		`);
		const results = runRules({ analyzer, rules: [noWaitForTimeoutRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
