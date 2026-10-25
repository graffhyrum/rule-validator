import { describe, expect, it } from "bun:test";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";
import { typePredicateNameRule } from "./type-predicate-name.js";

function messages(code: string): string[] {
	const analyzer = createTestSourceFile(code);
	const results = runRules({ analyzer, rules: [typePredicateNameRule] });
	return results.flatMap((result) => result.violations.map((violation) => violation.message));
}

describe("type-predicate-name rule", () => {
	it("flags a guard whose name does not start with is or has", () => {
		expect(
			messages(`
				function checkUser(value: unknown): value is { id: string } {
					return false;
				}
				function isUser(value: unknown): value is { id: string } {
					return false;
				}
				function hasUser(value: unknown): value is { id: string } {
					return false;
				}
			`),
		).toEqual(["Type predicate checkUser must start with is or has."]);
	});

	it("flags an assertion whose name does not start with assert, is, or has", () => {
		expect(
			messages(`
				function ensureUser(value: unknown): asserts value is { id: string } {
					if (value === undefined) throw new Error("missing");
				}
				function assertUser(value: unknown): asserts value is { id: string } {
					if (value === undefined) throw new Error("missing");
				}
				function isReady(value: unknown): asserts value {
					if (value === undefined) throw new Error("missing");
				}
			`),
		).toEqual(["Assertion function ensureUser must start with assert, is, or has."]);
	});

	it("flags an arrow and an unnamed function expression bound to a bad name", () => {
		expect(
			messages(`
				const checkUser = (value: unknown): value is string => typeof value === "string";
				const isUser = (value: unknown): value is string => typeof value === "string";
				const checkId = function (value: unknown): value is string {
					return typeof value === "string";
				};
			`),
		).toEqual([
			"Type predicate checkUser must start with is or has.",
			"Type predicate checkId must start with is or has.",
		]);
	});

	it("flags a named function expression once, under the function name", () => {
		expect(
			messages(`
				const bound = function checkUser(value: unknown): value is string {
					return false;
				};
			`),
		).toEqual(["Type predicate checkUser must start with is or has."]);
	});

	it("flags a bad annotation once when the arrow repeats the predicate", () => {
		expect(
			messages(`
				const checkUser: (value: unknown) => value is string = (value: unknown): value is string =>
					typeof value === "string";
			`),
		).toEqual(["Type predicate checkUser must start with is or has."]);
	});

	it("flags class methods, property arrows, interface methods, and function properties", () => {
		expect(
			messages(`
				class Guards {
					checkUser(value: unknown): value is string {
						return false;
					}
					isUser(value: unknown): value is string {
						return false;
					}
					checkId = (value: unknown): value is string => false;
				}
				interface Checks {
					checkUser(value: unknown): value is string;
					isUser(value: unknown): value is string;
					check: (value: unknown) => value is string;
					verify: ((value: unknown) => value is string);
				}
			`),
		).toEqual([
			"Type predicate checkUser must start with is or has.",
			"Type predicate checkId must start with is or has.",
			"Type predicate checkUser must start with is or has.",
			"Type predicate check must start with is or has.",
			"Type predicate verify must start with is or has.",
		]);
	});

	it("ignores a computed name, a string method name, and an arrow with no predicate", () => {
		expect(
			messages(`
				const checks = {
					["checkUser"]: (value: unknown): value is string => false,
				};
				class Checks {
					"checkUser"(value: unknown): value is string {
						return false;
					}
				}
				const checkUser = (value: unknown) => typeof value === "string";
			`),
		).toEqual([]);
	});

	it("does not flag an anonymous callback", () => {
		expect(
			messages(`
				const values: unknown[] = [];
				const numbers = values.filter((value: unknown): value is number => typeof value === "number");
			`),
		).toEqual([]);
	});
});
