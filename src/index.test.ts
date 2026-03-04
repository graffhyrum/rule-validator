import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";

// Mock RULES module
const mockRules = [
	{
		name: "test-rule",
		pattern: /violation/g,
		message: "Test violation found",
		severity: "error",
	},
	{
		name: "warning-rule",
		pattern: /warning/g,
		message: "Test warning found",
		severity: "warning",
	},
];

mock.module("./rules", () => ({
	RULES: mockRules,
}));

afterAll(() => mock.restore());

import {
	checkLineForViolations,
	countBySeverity,
	exitWithResult,
	type PrintableViolation,
	printViolations,
	scanFile,
	scanFiles,
	shouldProcessFile,
	type Violation,
} from "./index";

describe("scanFile", () => {
	it("should scan file and return violations", async () => {
		const mockContent = "some code with violation\nanother line with warning";
		const mockReader = {
			readFile: () => Promise.resolve(mockContent),
		};

		const violations = await scanFile("test.ts", mockReader);

		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({
			file: "test.ts",
			line: 1,
			rule: mockRules[0],
			match: "violation",
		});
		expect(violations[1]).toMatchObject({
			file: "test.ts",
			line: 2,
			rule: mockRules[1],
			match: "warning",
		});
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
			line: "some code with violation and warning",
			lineIndex: 0,
			filePath: "test.ts",
			violations,
		};

		checkLineForViolations(params);

		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({
			file: "test.ts",
			line: 1,
			column: 16,
			rule: expect.any(Object),
			match: "violation",
		});
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
	});

	it("should return true when exclude name not present", () => {
		expect(shouldProcessFile("test.ts", "rule-validator")).toBe(true);
	});
});

describe("countBySeverity", () => {
	const mockViolations: Violation[] = [
		{
			file: "test.ts",
			line: 1,
			column: 0,
			rule: { name: "error-rule", pattern: /./, message: "error", severity: "error" },
			match: "error",
		},
		{
			file: "test.ts",
			line: 2,
			column: 0,
			rule: { name: "warning-rule", pattern: /./, message: "warning", severity: "warning" },
			match: "warning",
		},
		{
			file: "test.ts",
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

		const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("violation here");
		expect(allOutput).toContain("~".repeat(errorViolation.match.length));
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

		const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(allOutput).toContain("warning-rule");
		expect(allOutput).toContain("Test warning found");
	});
});

describe("scanFiles", () => {
	it("should find violations in a temp file containing a pattern match", async () => {
		const filename = `rv-test-${Date.now()}.ts`;
		writeFileSync(filename, "// violation on this line\n");

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
		writeFileSync(filename, "// violation in this file\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [], json: true });
			expect(Array.isArray(result.violations)).toBe(true);
			expect(result.violations.length).toBeGreaterThan(0);
		} finally {
			unlinkSync(filename);
		}
	});

	it("should leave violations undefined when json option is false", async () => {
		const filename = `rv-nojson-${Date.now()}.ts`;
		writeFileSync(filename, "// violation here\n");

		try {
			const result = await scanFiles(filename, { excludePatterns: [], json: false });
			expect(result.violations).toBeUndefined();
		} finally {
			unlinkSync(filename);
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
			exitWithResult(2, 1);
		} catch {
			// expected: process.exit throws in test
		}

		expect(exitSpy).toHaveBeenCalledWith(1);
		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("Fix errors before proceeding");
		exitSpy.mockRestore();
		logSpy.mockRestore();
	});

	it("exits 0 and prints warning report when only warnings", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit 0");
		});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			exitWithResult(0, 3);
		} catch {
			// expected
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("Consider fixing warnings");
		exitSpy.mockRestore();
		logSpy.mockRestore();
	});

	it("exits 0 and prints success with file and rule counts when no violations", () => {
		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit 0");
		});
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			exitWithResult(0, 0, 5);
		} catch {
			// expected
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("5 files passed");
		expect(output).toContain("rules checked");
		exitSpy.mockRestore();
		logSpy.mockRestore();
	});
});
