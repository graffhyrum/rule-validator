import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

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

import {
	checkLineForViolations,
	countBySeverity,
	Rule,
	scanFile,
	shouldProcessFile,
	type Violation,
} from "./index";

const mockBunFile = {
	text: () => Promise.resolve("content"),
	slice: () => mockBunFile,
	writer: () => ({
		start: () => {},
		ref: () => {},
		unref: () => {},
		write: (data: any) => Promise.resolve(0),
		end: () => Promise.resolve(0),
		flush: () => Promise.resolve(0),
	}),
	write: () => mockBunFile.writer(),
	unlink: () => Promise.resolve(),
	delete: () => Promise.resolve(),
	stat: () => Promise.resolve({}),
	stream: () => new ReadableStream(),
	lastModified: 0,
	exists: () => Promise.resolve(true),
	size: 0,
	type: "",
	name: "",
	arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
	bytes: () => Promise.resolve(new Uint8Array(0)),
	json: () => Promise.resolve(null),
	formData: () => Promise.resolve(new FormData()),
	blob: () => new Blob(),
};

describe("scanFile", () => {
	const originalFile = Bun.file;

	beforeEach(() => {
		Bun.file = mock((path: string | URL) => mockBunFile);
	});

	afterEach(() => {
		Bun.file = originalFile;
	});

	it("should scan file and return violations", async () => {
		mockBunFile.text = () => Promise.resolve("some code with violation\nanother line with warning");

		const violations = await scanFile("test.ts");

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
		mockBunFile.text = () => Promise.resolve("clean code");

		const violations = await scanFile("clean.ts");

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
			column: 15,
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
