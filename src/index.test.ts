import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";
import {
	checkLineForViolations,
	countBySeverity,
	exitWithResult,
	type PrintableViolation,
	printSummaryReport,
	printViolations,
	scanFile,
	scanFiles,
	shouldProcessFile,
	type Violation,
} from "./index.ts";
import { asRelativePosix } from "./paths.ts";

describe("scanFile", () => {
	it("should scan file and return violations", async () => {
		const mockContent =
			"page.waitForTimeout(1);\nimport { Elysia } from 'elysia';\nnew Response(body);\n";
		const mockReader = {
			readFile: () => Promise.resolve(mockContent),
		};

		const violations = await scanFile("test.ts", mockReader);

		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({
			file: "test.ts",
			line: 1,
			rule: expect.objectContaining({ name: "no-waitForTimeout", severity: "error" }),
			match: ".waitForTimeout(",
		});
		expect(violations[1]).toMatchObject({
			file: "test.ts",
			line: 3,
			rule: expect.objectContaining({
				name: "no-raw-response-in-elysia",
				severity: "warning",
				message:
					"Unexpected `new Response()`. Use set.status, set.headers, and redirect() in Elysia handlers.",
			}),
			match: "new Response(",
		});
	});

	it("skips a rule when that file is in ruleExcludes", async () => {
		const mockReader = {
			readFile: () => Promise.resolve("page.waitForTimeout(1);\n"),
		};
		const violations = await scanFile("src/page.ts", mockReader, {
			"no-waitForTimeout": { exclude: ["src/page.ts"] },
		});
		expect(violations).toEqual([]);
	});

	it("still flags a rule when the exclude pattern names another file", async () => {
		const mockReader = {
			readFile: () => Promise.resolve("page.waitForTimeout(1);\n"),
		};
		const violations = await scanFile("src/page.ts", mockReader, {
			"no-waitForTimeout": { exclude: ["src/other.ts"] },
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.rule.name).toBe("no-waitForTimeout");
	});

	it("should return empty array for file with no violations", async () => {
		const mockReader = {
			readFile: () => Promise.resolve("clean code"),
		};

		const violations = await scanFile("clean.ts", mockReader);

		expect(violations).toHaveLength(0);
	});
});

describe("checkLineForViolations", () => {
	it("should check line for violations and add to array", () => {
		const violations: Violation[] = [];
		const params = {
			line: "page.waitForTimeout(1); const x = y as unknown as T",
			lineIndex: 0,
			filePath: "test.ts",
			violations,
		};

		checkLineForViolations(params);

		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({
			file: "test.ts",
			line: 1,
			column: 5,
			rule: expect.objectContaining({ name: "no-waitForTimeout" }),
			match: ".waitForTimeout(",
		});
	});

	it("skips the line when ruleExcludes names this file", () => {
		const violations: Violation[] = [];
		checkLineForViolations({
			line: "page.waitForTimeout(1);",
			lineIndex: 0,
			filePath: "src/page.ts",
			violations,
			relPath: asRelativePosix("src/page.ts"),
			ruleExcludes: { "no-waitForTimeout": { exclude: ["src/page.ts"] } },
		});
		expect(violations).toEqual([]);
	});

	it("flags the line when ruleExcludes names another file", () => {
		const violations: Violation[] = [];
		checkLineForViolations({
			line: "page.waitForTimeout(1);",
			lineIndex: 0,
			filePath: "src/page.ts",
			violations,
			relPath: asRelativePosix("src/page.ts"),
			ruleExcludes: { "no-waitForTimeout": { exclude: ["src/other.ts"] } },
		});
		expect(violations).toHaveLength(1);
	});

	it("should not add violations for clean line", () => {
		const violations: Violation[] = [];
		const params = {
			line: "clean code",
			lineIndex: 0,
			filePath: "test.ts",
			violations,
		};

		checkLineForViolations(params);

		expect(violations).toHaveLength(0);
	});
});

describe("shouldProcessFile", () => {
	it("should return true for valid TypeScript files", () => {
		expect(shouldProcessFile("test.ts")).toBe(true);
		expect(shouldProcessFile("test.tsx")).toBe(true);
		expect(shouldProcessFile("test.js")).toBe(true);
		expect(shouldProcessFile("test.jsx")).toBe(true);
	});

	it("should return false for invalid extensions", () => {
		expect(shouldProcessFile("test.txt")).toBe(false);
		expect(shouldProcessFile("test.md")).toBe(false);
		expect(shouldProcessFile("test.json")).toBe(false);
	});

	it("should return false when file contains exclude name", () => {
		expect(shouldProcessFile("rule-validator.ts", "rule-validator")).toBe(false);
		expect(shouldProcessFile("some/rule-validator/file.ts", "rule-validator")).toBe(false);
		expect(shouldProcessFile("some\\rule-validator\\file.ts", "rule-validator")).toBe(false);
	});

	it("should return true when exclude name not present", () => {
		expect(shouldProcessFile("test.ts", "rule-validator")).toBe(true);
	});
});

describe("countBySeverity", () => {
	const mockViolations: Violation[] = [
		{
			file: asRelativePosix("test.ts"),
			line: 1,
			column: 0,
			rule: { name: "error-rule", pattern: /./, message: "error", severity: "error" },
			match: "error",
		},
		{
			file: asRelativePosix("test.ts"),
			line: 2,
			column: 0,
			rule: { name: "warning-rule", pattern: /./, message: "warning", severity: "warning" },
			match: "warning",
		},
		{
			file: asRelativePosix("test.ts"),
			line: 3,
			column: 0,
			rule: { name: "error-rule2", pattern: /./, message: "error2", severity: "error" },
			match: "error2",
		},
	];

	it("should count errors correctly", () => {
		const count = countBySeverity(mockViolations, "error");
		expect(count).toBe(2);
	});

	it("should count warnings correctly", () => {
		const count = countBySeverity(mockViolations, "warning");
		expect(count).toBe(1);
	});

	it("should return 0 for empty array", () => {
		const count = countBySeverity([], "error");
		expect(count).toBe(0);
	});
});

describe("printViolations", () => {
	let logSpy: ReturnType<typeof spyOn<Console, "log">>;
	const errorViolation: PrintableViolation = {
		line: 3,
		column: 5,
		rule: { name: "test-rule", message: "Test violation found", severity: "error" },
		match: "violation",
		sourceLine: "  violation here",
	};
	const warningViolation: PrintableViolation = {
		line: 7,
		column: 1,
		rule: { name: "warning-rule", message: "Test warning found", severity: "warning" },
		match: "warning",
	};

	beforeEach(() => {
		logSpy = spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
	});

	it("should log the file name as the first call", () => {
		printViolations("src/foo.ts", [errorViolation]);

		const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("src/foo.ts");
	});

	it("should include rule name and message in output for error violations", () => {
		printViolations("src/foo.ts", [errorViolation]);

		const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("test-rule");
		expect(allOutput).toContain("Test violation found");
	});

	it("should include source line and underline when sourceLine is present", () => {
		printViolations("src/foo.ts", [errorViolation]);

		const lines = logSpy.mock.calls.map((c) => String(c[0]));
		const detail = lines.find((line) => line.includes("Test violation found"));
		const source = lines.find((line) => line.includes("violation here"));
		const underline = lines.find((line) => line.includes("~"));
		if (!detail || !source || !underline) {
			throw new Error("missing printViolations lines");
		}
		expect(detail).toContain("  3:5");
		expect(detail).toContain("error  Test violation found");
		expect(detail).not.toContain("warning");
		expect(underline).toContain(`${" ".repeat(8)}${"~".repeat(errorViolation.match.length)}`);
		expect(underline).not.toContain(`${" ".repeat(10)}${"~".repeat(errorViolation.match.length)}`);
	});

	it("should not include underline lines when sourceLine is absent", () => {
		printViolations("src/foo.ts", [warningViolation]);

		const tilds = logSpy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("~"));
		expect(tilds).toHaveLength(0);
	});

	it("should emit a trailing blank line after all violations", () => {
		printViolations("src/foo.ts", [errorViolation]);

		const lastCall = logSpy.mock.calls.at(-1);
		expect(lastCall).toBeDefined();
		expect(String(lastCall![0])).toBe("");
	});

	it("should include warning-rule name for warning severity", () => {
		printViolations("src/bar.ts", [warningViolation]);

		const detail = logSpy.mock.calls
			.map((c) => String(c[0]))
			.find((line) => line.includes("Test warning found"));
		if (!detail) throw new Error("missing printViolations line");
		expect(detail).toContain("warning  Test warning found");
		expect(detail).toContain("warning-rule");
		expect(detail).not.toContain("error");
	});
});

describe("scanFiles", () => {
	it("should find violations in a temp file containing a pattern match", async () => {
		const filename = `rv-test-${Date.now()}.ts`;
		writeFileSync(filename, "page.waitForTimeout(1);\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [] });
			expect(result.errorCount + result.warningCount).toBeGreaterThan(0);
			expect(result.fileCount).toBeGreaterThanOrEqual(1);
		} finally {
			unlinkSync(filename);
		}
	});

	it("should return zero violations for a file with no rule matches", async () => {
		const filename = `rv-clean-${Date.now()}.ts`;
		writeFileSync(filename, "const greeting = 'hello';\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [] });
			expect(result.errorCount).toBe(0);
			expect(result.warningCount).toBe(0);
		} finally {
			unlinkSync(filename);
		}
	});

	it("should populate violations array when json option is true", async () => {
		const filename = `rv-json-${Date.now()}.ts`;
		writeFileSync(filename, "page.waitForTimeout(1);\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [], json: true });
			expect(result.violations).toHaveLength(1);
			expect(result.violations[0]?.message).toBe(
				"Unexpected static timeout. Use Playwright auto-waiting or web-first assertions instead. See https://playwright.dev/docs/api/class-page#page-wait-for-timeout",
			);
			expect(result.violations[0]?.rule).toBe("no-waitForTimeout");
		} finally {
			unlinkSync(filename);
		}
	});

	it("counts a warning from an elysia Response", async () => {
		const filename = `rv-warn-${Date.now()}.ts`;
		writeFileSync(filename, 'import { Elysia } from "elysia";\nreturn new Response(body);\n');
		try {
			const result = await scanFiles(filename, { excludePatterns: [] });
			expect(result.errorCount).toBe(0);
			expect(result.warningCount).toBe(1);
		} finally {
			unlinkSync(filename);
		}
	});

	it("skips rule-validator.ts when no exclude name is passed", async () => {
		const filename = "rule-validator.ts";
		writeFileSync(filename, "page.waitForTimeout(1);\n");
		try {
			const result = await scanFiles(filename);
			expect(result.fileCount).toBe(0);
			expect(result.errorCount).toBe(0);
		} finally {
			unlinkSync(filename);
		}
	});

	it("scans a file when options omit config", async () => {
		const filename = `rv-noconfig-${Date.now()}.ts`;
		writeFileSync(filename, "const greeting = 'hello';\n");
		try {
			const result = await scanFiles(filename, { excludePatterns: [] });
			expect(result.fileCount).toBe(1);
			expect(result.errorCount).toBe(0);
		} finally {
			unlinkSync(filename);
		}
	});

	it("counts only ts files when the glob also matches a text file", async () => {
		const id = `rv-mix-${Date.now()}`;
		const tsFile = `${id}.ts`;
		const txtFile = `${id}.txt`;
		writeFileSync(tsFile, "page.waitForTimeout(1);\n");
		writeFileSync(txtFile, "page.waitForTimeout(1);\n");
		try {
			const result = await scanFiles(`${id}.*`, { excludePatterns: [] });
			expect(result.fileCount).toBe(1);
			expect(result.errorCount).toBe(1);
			expect(result.displayViolations?.map((violation) => violation.rule.name)).toEqual([
				"no-waitForTimeout",
			]);
		} finally {
			unlinkSync(tsFile);
			unlinkSync(txtFile);
		}
	});

	it("should leave violations undefined when json option is false", async () => {
		const filename = `rv-nojson-${Date.now()}.ts`;
		writeFileSync(filename, "page.waitForTimeout(1);\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [], json: false });
			expect(result.violations).toBeUndefined();
		} finally {
			unlinkSync(filename);
		}
	});
});

describe("printSummaryReport", () => {
	it("prints plain zero counts", () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		try {
			printSummaryReport(0, 0);
			const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
			expect(output).toContain("0 violations");
			expect(output).toContain("0 errors");
			expect(output).toContain("0 warnings");
		} finally {
			logSpy.mockRestore();
		}
	});
});

describe("exitWithResult", () => {
	it("exits 1 and prints error report when errorCount > 0", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit 1");
		});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			try {
				exitWithResult(2, 1);
			} catch {
				// expected: process.exit throws in test
			}
			expect(exitSpy).toHaveBeenCalledWith(1);
			const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
			expect(output).toContain("Fix errors before proceeding");
			expect(output).toContain("3 violations");
			expect(output).toContain("2 errors");
			expect(output).toContain("1 warnings");
			expect(output).not.toContain("\n\n\n");
		} finally {
			exitSpy.mockRestore();
			logSpy.mockRestore();
		}
	});

	it("exits 0 and prints warning report when only warnings", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit 0");
		});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			try {
				exitWithResult(0, 3);
			} catch {
				// expected
			}
			expect(exitSpy).toHaveBeenCalledWith(0);
			const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
			expect(output).toContain("Consider fixing warnings");
			expect(output).toContain("3 violations");
			expect(output).toContain("0 errors");
			expect(output).toContain("3 warnings");
			expect(output).not.toContain("\n\n\n");
		} finally {
			exitSpy.mockRestore();
			logSpy.mockRestore();
		}
	});

	it("exits 0 and prints success with file and rule counts when no violations", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit 0");
		});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			try {
				exitWithResult(0, 0, 5);
			} catch {
				// expected
			}
			expect(exitSpy).toHaveBeenCalledWith(0);
			const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
			expect(output).toContain("5 files passed");
			expect(output).toContain("rules checked");
			expect(output).not.toContain("violations");
			expect(output).not.toContain("\n\n\n");
		} finally {
			exitSpy.mockRestore();
			logSpy.mockRestore();
		}
	});
});
