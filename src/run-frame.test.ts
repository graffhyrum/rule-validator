import { describe, expect, it } from "bun:test";
import {
	classifyOutcome,
	formatRunFooter,
	formatRunHeader,
	outcomeExitCode,
	type RunOutcome,
} from "./run-frame.ts";

function stripAnsi(s: string): string {
	return s.replace(/\u001B\[[0-9;]*m/g, "");
}

describe("classifyOutcome", () => {
	it("errors dominate when errorCount > 0", () => {
		expect(
			classifyOutcome({ errorCount: 2, warningCount: 5, fileCount: 10, ruleCount: 17 }),
		).toEqual({
			kind: "errors",
			errorCount: 2,
			warningCount: 5,
		});
	});

	it("warnings when only warnings", () => {
		expect(
			classifyOutcome({ errorCount: 0, warningCount: 3, fileCount: 10, ruleCount: 17 }),
		).toEqual({
			kind: "warnings",
			warningCount: 3,
		});
	});

	it("passed when no violations", () => {
		expect(
			classifyOutcome({ errorCount: 0, warningCount: 0, fileCount: 42, ruleCount: 17 }),
		).toEqual({
			kind: "passed",
			fileCount: 42,
			ruleCount: 17,
		});
	});
});

describe("outcomeExitCode", () => {
	it("returns 0 for passed and warnings", () => {
		expect(outcomeExitCode({ kind: "passed", fileCount: 1, ruleCount: 1 })).toBe(0);
		expect(outcomeExitCode({ kind: "warnings", warningCount: 1 })).toBe(0);
	});

	it("returns 1 for errors and crashed", () => {
		expect(outcomeExitCode({ kind: "errors", errorCount: 1, warningCount: 0 })).toBe(1);
		expect(outcomeExitCode({ kind: "crashed" })).toBe(1);
	});
});

describe("formatRunHeader", () => {
	it("renders tool-name rule line at width 40", () => {
		expect(stripAnsi(formatRunHeader(40))).toBe(
			"── rule-validator ──────────────────────",
		);
	});
});

describe("formatRunFooter", () => {
	it("passed carries file and rule counts", () => {
		const line = stripAnsi(
			formatRunFooter({ kind: "passed", fileCount: 42, ruleCount: 17 }, 40),
		);
		expect(line).toContain("✔ All 42 files passed (17 rules checked).");
		expect(line.startsWith("── ")).toBe(true);
		expect(line.endsWith("─")).toBe(true);
	});

	it("warnings carries existing verdict copy", () => {
		expect(
			stripAnsi(formatRunFooter({ kind: "warnings", warningCount: 2 }, 40)),
		).toContain("⚠ Consider fixing warnings for better compliance.");
	});

	it("errors carries existing verdict copy", () => {
		expect(
			stripAnsi(
				formatRunFooter({ kind: "errors", errorCount: 2, warningCount: 0 }, 40),
			),
		).toBe("── ✖ Fix errors before proceeding. ─────");
	});

	it("crashed carries run-failed copy", () => {
		expect(stripAnsi(formatRunFooter({ kind: "crashed" }, 40))).toContain(
			"✖ Run failed.",
		);
	});

	it("throws when the kind is outside the outcome union", () => {
		const outcome: RunOutcome = JSON.parse('{"kind":"other"}');
		expect(() => formatRunFooter(outcome, 40)).toThrow("unhandled outcome");
		expect(() => outcomeExitCode(outcome)).toThrow("unhandled outcome");
	});
});
