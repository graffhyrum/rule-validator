// Tests for RULES regex patterns — one positive + one negative case per rule
// Patterns are inlined to stay isolated from mock.module in index.test.ts
import { describe, expect, test } from "bun:test";
import type { Rule } from "./index";

// fileGuards inlined to avoid mock.module interception in the full suite
const noRawResponseFileGuard = (content: string) => /from ['"]elysia['"]/.test(content);
const noRawLocatorInSpecFileGuard = (content: string) => /test\.describe\s*\(/.test(content);

const RULES: Rule[] = [
	{
		name: "no-waitForTimeout",
		pattern: /\b\.waitForTimeout\s*\(/g,
		message: "Unexpected static timeout.",
		severity: "error",
	},
	{
		name: "template-literals-only",
		pattern: /"\s*\+\s*"|"\S+"\s*\+\s*\S+(?!\s*\))|\S+\s*\+\s*"[^"]*"(?!\s*\))/g,
		message: "Use template literals instead of string concatenation.",
		severity: "error",
	},
	{
		name: "no-static-classes",
		pattern: /export\s+class\s+\w+Impl/g,
		message: "Static-only class detected.",
		severity: "error",
	},
	{
		name: "no-unknown-as-cast",
		pattern: / as unknown as\b/g,
		message: "Double cast via `as unknown as T` bypasses type safety.",
		severity: "error",
	},
	{
		name: "no-expect-typeof-tobe",
		pattern: /expect\s*\(\s*typeof\s+.+\)\s*\.toBe\s*\(/g,
		message: "Unexpected `expect(typeof x).toBe()`.",
		severity: "error",
	},
	{
		name: "no-toBeInstanceOf",
		pattern: /\.toBeInstanceOf\s*\((?!ArkErrors)/g,
		message: "Unexpected `toBeInstanceOf()`.",
		severity: "error",
	},
	{
		name: "no-raw-response-in-elysia",
		pattern: /new Response\s*\((?!proc\.)/g,
		message: "Unexpected `new Response()`.",
		severity: "warning",
	},
	{
		name: "no-raw-locator-in-spec",
		pattern: /\bpage\.locator\s*\(/g,
		message: "Raw page.locator() in spec file.",
		severity: "error",
	},
];

// SYNC CHECK: inline count must equal the number of rules in src/rules.ts.
// When adding a rule there, add it here too, then update the count below.
test("RULES.length matches src/rules.ts (update both when adding rules)", () => {
	expect(RULES.length).toBe(8);
});

function matchesRule(ruleName: string, line: string): RegExpMatchArray[] {
	const rule = RULES.find((r) => r.name === ruleName);
	if (!rule) throw new Error(`Rule not found: ${ruleName}`);
	return [...line.matchAll(rule.pattern)];
}

describe("no-waitForTimeout", () => {
	const rule = "no-waitForTimeout";

	test("flags .waitForTimeout(", () => {
		expect(matchesRule(rule, "await page.waitForTimeout(1000);")).toHaveLength(1);
	});

	test("ignores word without dot prefix", () => {
		expect(matchesRule(rule, "// waitForSelector is preferred")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("template-literals-only", () => {
	const rule = "template-literals-only";

	test("flags string concatenation with +", () => {
		expect(matchesRule(rule, 'const s = "hello" + " world";').length).toBeGreaterThan(0);
	});

	test("ignores numeric addition", () => {
		expect(matchesRule(rule, "const n = 1 + 2;")).toHaveLength(0);
	});

	test("flags variable + string concatenation", () => {
		expect(matchesRule(rule, 'const s = name + " is great";')).toHaveLength(1);
	});

	test("ignores plus sign inside a string literal (SRI hash)", () => {
		expect(
			matchesRule(
				rule,
				'  "sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+";',
			),
		).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("no-static-classes", () => {
	const rule = "no-static-classes";

	test("flags 'export class FooImpl'", () => {
		expect(matchesRule(rule, "export class ServiceImpl {}")).toHaveLength(1);
	});

	test("ignores class without Impl suffix", () => {
		expect(matchesRule(rule, "export class Service {}")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("no-unknown-as-cast", () => {
	const rule = "no-unknown-as-cast";

	test("flags 'as unknown as T'", () => {
		expect(matchesRule(rule, "const x = value as unknown as string;")).toHaveLength(1);
	});

	test("ignores plain 'as string' cast", () => {
		expect(matchesRule(rule, "const x = value as string;")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("no-expect-typeof-tobe", () => {
	const rule = "no-expect-typeof-tobe";

	test("flags expect(typeof x).toBe(", () => {
		expect(matchesRule(rule, "expect(typeof value).toBe('string');")).toHaveLength(1);
	});

	test("ignores expect(value).toBe( without typeof", () => {
		expect(matchesRule(rule, "expect(value).toBe('string');")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("no-toBeInstanceOf", () => {
	const rule = "no-toBeInstanceOf";

	test("flags .toBeInstanceOf(", () => {
		expect(matchesRule(rule, "expect(err).toBeInstanceOf(Error);")).toHaveLength(1);
	});

	test("ignores toBeInstanceOf without leading dot", () => {
		expect(matchesRule(rule, "const toBeInstanceOf = noop;")).toHaveLength(0);
	});

	test("allows toBeInstanceOf(ArkErrors)", () => {
		expect(matchesRule(rule, "expect(err).toBeInstanceOf(ArkErrors);")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});
});

describe("no-raw-response-in-elysia", () => {
	const rule = "no-raw-response-in-elysia";

	test("flags new Response( without proc.stdout", () => {
		expect(matchesRule(rule, "return new Response(JSON.stringify(data));")).toHaveLength(1);
	});

	test("ignores new Response(proc. (Bun stream read exemption)", () => {
		expect(matchesRule(rule, "const text = new Response(proc.stdout).text();")).toHaveLength(0);
	});

	test("severity is warning", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("warning");
	});

	test("fileGuard returns true when content imports from elysia", () => {
		expect(noRawResponseFileGuard('import { Elysia } from "elysia"')).toBe(true);
	});

	test("fileGuard returns false when content has no elysia import", () => {
		expect(noRawResponseFileGuard("const x = new Response(body);")).toBe(false);
	});
});

describe("no-raw-locator-in-spec", () => {
	const rule = "no-raw-locator-in-spec";

	test("flags page.locator( in spec content", () => {
		expect(matchesRule(rule, "const btn = page.locator('button');")).toHaveLength(1);
	});

	test("ignores page.getByRole( (POM-friendly locator)", () => {
		expect(matchesRule(rule, "const btn = page.getByRole('button');")).toHaveLength(0);
	});

	test("severity is error", () => {
		expect(RULES.find((r) => r.name === rule)?.severity).toBe("error");
	});

	test("fileGuard returns true when content contains test.describe", () => {
		expect(noRawLocatorInSpecFileGuard("test.describe('suite', () => {")).toBe(true);
	});

	test("fileGuard returns false when content has no test.describe", () => {
		expect(noRawLocatorInSpecFileGuard("export class MyPom {}")).toBe(false);
	});
});
