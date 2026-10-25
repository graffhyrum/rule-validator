import { describe, expect, it } from "bun:test";
import { arktypeSchemaStringsRule } from "./arktype-schema-strings.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";

function messages(code: string): string[] {
	const analyzer = createTestSourceFile(code);
	const results = runRules({ analyzer, rules: [arktypeSchemaStringsRule] });
	return results.flatMap((result) => result.violations.map((violation) => violation.message));
}

describe("arktype-schema-strings rule", () => {
	it("flags keyword order and instanceof without parentheses inside type()", () => {
		expect(
			messages(`
				import { type } from "arktype";
				type({
					email: "string.min(5).email",
					pattern: "string.pattern(/email/).email",
					when: "instanceof Date",
					ok: "string.email.min(5)",
					password: "string.min(8).pattern(/[A-Z]/)",
					name: "string.alphanumeric.min(3).max(20)",
					id: "string.uuid?.nonempty",
					date: "instanceof(Date)",
					spaced: "instanceof (Error)",
				});
			`),
		).toEqual([
			"ArkType keyword email comes after min. Put email first.",
			"ArkType keyword email comes after pattern. Put email first.",
			"ArkType instanceof needs parentheses. Write instanceof(Class).",
		]);
	});

	it("follows a renamed import and a namespace import", () => {
		expect(
			messages(`
				import { type as schema } from "arktype";
				import * as ark from "arktype";
				schema("string.min(5).url");
				ark.type("instanceof Map");
			`),
		).toEqual([
			"ArkType keyword url comes after min. Put url first.",
			"ArkType instanceof needs parentheses. Write instanceof(Class).",
		]);
	});

	it("flags a template literal schema and a string that has both problems", () => {
		expect(
			messages(`
				import { type } from "arktype";
				type(\`string.max(4).integer\`);
				type("instanceof Date|string.min(1).hex");
			`),
		).toEqual([
			"ArkType keyword integer comes after max. Put integer first.",
			"ArkType instanceof needs parentheses. Write instanceof(Class).",
			"ArkType keyword hex comes after min. Put hex first.",
		]);
	});

	it("ignores an arktype import that does not bind type", () => {
		expect(
			messages(`
				import "arktype";
				import type { type } from "arktype";
				import ark from "arktype";
				type("instanceof Date");
				ark("string.min(1).email");
			`),
		).toEqual([]);
	});

	it("ignores schemas when the file does not import arktype", () => {
		expect(
			messages(`
				type("string.min(5).email");
				type("instanceof Date");
			`),
		).toEqual([]);
	});

	it("ignores strings that are not schema arguments of type()", () => {
		expect(
			messages(`
				import { type } from "arktype";
				import { type Foo } from "arktype";
				const loose = "string.min(5).email";
				type({ label: name("string.min(5).email"), ok: "string.email" });
				function name(value: string): string {
					return value;
				}
			`),
		).toEqual([]);
	});
});
