import type { Rule } from "./index.js";

export const RULES: Rule[] = [
	{
		name: "no-waitForTimeout",
		pattern: /\b\.waitForTimeout\s*\(/g,
		message:
			"AVOID STATIC TIMEOUTS: Use Playwright's auto-waiting and web-first assertions instead of waitForTimeout(). See https://playwright.dev/docs/actionability and https://playwright.dev/docs/best-practices#use-web-first-assertions",
		severity: "error",
	},
	{
		name: "no-any-types",
		pattern: /:\s*any\b/g,
		message: `STRICT MODE: No any types, define schemas with arkType, infer types from the schemas with 'typeof schema.infer', and narrow variables with TS assertion functions. (function assertIsSomeType(x:unknown): asserts x is SomeType { someTypeSchema.assert(x);}; )`,
		severity: "error",
	},
	{
		name: "template-literals-only",
		pattern: /"\s*\+\s*"|"\S+"\s*\+\s*\S+(?!\s*\))|\S+\s*\+\s*"(?!\s*\))/g,
		message: "TEMPLATE LITERALS ONLY: Use template literal syntax not string concatenation",
		severity: "error",
	},
	{
		name: "no-static-classes",
		pattern: /export\s+class\s+\w+Impl/g,
		message: "AVOID STATIC-ONLY CLASSES: Convert to module functions",
		severity: "error",
	},
	{
		name: "no-unknown-as-cast",
		pattern: / as unknown as\b/g,
		message:
			"BAN double cast (as unknown as T): Use proper typing, assertion functions, or type-safe patterns instead of escaping through unknown.",
		severity: "error",
	},
	{
		name: "no-expect-typeof-tobe",
		pattern: /expect\s*\(\s*typeof\s+.+\)\s*\.toBe\s*\(/g,
		message:
			"BAN expect(typeof x).toBe(type): Asserting typeof is a type-system concern; " +
			"use TypeScript and interface contract tests (input→output), or arktype schema assertions, not runtime type checks.",
		severity: "error",
	},
	{
		name: "no-toBeInstanceOf",
		pattern: /\.toBeInstanceOf\s*\(/g,
		message:
			"BAN expect(x).toBeInstanceOf(C): Asserting constructor/instance type is a type-system concern; " +
			"use TypeScript and behavior-focused assertions instead.",
		severity: "error",
	},
];
