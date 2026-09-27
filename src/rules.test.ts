import { describe, expect, test } from "bun:test";
import { checkLineForViolations, scanFile, type Violation } from "./index.ts";
import { RULES, type Rule } from "./rules.ts";
test("RULES.length matches the regex rule table", () => {
    expect(RULES.map((rule) => rule.name)).toEqual([
        "no-waitForTimeout",
        "template-literals-only",
        "no-static-classes",
        "no-unknown-as-cast",
        "no-expect-typeof-tobe",
        "no-toBeInstanceOf",
        "no-raw-response-in-elysia",
        "no-raw-locator-in-spec",
    ]);
});
describe("no-waitForTimeout", () => {
    const rule = "no-waitForTimeout";
    test("flags .waitForTimeout(", () => {
        expect(matchesRule(rule, "await page.waitForTimeout(1000);")).toHaveLength(1);
    });
    test("flags a space before the paren", () => {
        expect(matchesRule(rule, "await page.waitForTimeout (1000);")).toHaveLength(1);
    });
    test("ignores word without dot prefix", () => {
        expect(matchesRule(rule, "// waitForSelector is preferred")).toHaveLength(0);
    });
    test("reports the static-timeout message", () => {
        expect(hitsFor(rule, "await page.waitForTimeout(1000);")[0]?.rule.message).toBe("Unexpected static timeout. Use Playwright auto-waiting or web-first assertions instead. See https://playwright.dev/docs/api/class-page#page-wait-for-timeout");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
});
describe("template-literals-only", () => {
    const rule = "template-literals-only";
    test("flags two quotes with a plus between them", () => {
        expect(matchesRule(rule, '"+"')[0]?.[0]).toBe('"+"');
        expect(matchesRule(rule, '" + "')[0]?.[0]).toBe('" + "');
    });
    test("flags a quoted word plus an identifier with no spaces", () => {
        expect(matchesRule(rule, '"hello"+name')[0]?.[0]).toBe('"hello"+name');
    });
    test("flags a quoted word plus an identifier when the space is only on one side", () => {
        expect(matchesRule(rule, '"hello" +name')[0]?.[0]).toBe('"hello" +name');
        expect(matchesRule(rule, '"hello"+ name')[0]?.[0]).toBe('"hello"+ name');
    });
    test("flags an identifier plus a quoted string with no spaces", () => {
        expect(matchesRule(rule, 'name+"x"')[0]?.[0]).toBe('name+"x"');
    });
    test("flags an identifier plus a quoted string", () => {
        expect(matchesRule(rule, 'const s = name + " is great";')).toHaveLength(1);
    });
    test("flags a one-character operand before a closing paren", () => {
        expect(matchesRule(rule, '"hello" + x)')).toHaveLength(1);
    });
    test("ignores a short operand with spaces before a closing paren", () => {
        expect(matchesRule(rule, '"hello" + x  )')).toHaveLength(0);
        expect(matchesRule(rule, 'n+"x"  )')).toHaveLength(0);
        expect(matchesRule(rule, 'name+"x")')).toHaveLength(0);
    });
    test("ignores numeric addition", () => {
        expect(matchesRule(rule, "const n = 1 + 2;")).toHaveLength(0);
    });
    test("ignores plus sign inside a string literal (SRI hash)", () => {
        expect(matchesRule(rule, '  "sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+";')).toHaveLength(0);
    });
    test("reports the template-literal message", () => {
        expect(hitsFor(rule, 'const s = name + " is great";')[0]?.rule.message).toBe("Use template literals instead of string concatenation.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
});
describe("no-static-classes", () => {
    const rule = "no-static-classes";
    test("flags 'export class FooImpl'", () => {
        expect(matchesRule(rule, "export class ServiceImpl {}")).toHaveLength(1);
    });
    test("flags extra spaces around class", () => {
        expect(matchesRule(rule, "export  class  ServiceImpl {}")).toHaveLength(1);
    });
    test("ignores class without Impl suffix", () => {
        expect(matchesRule(rule, "export class Service {}")).toHaveLength(0);
    });
    test("reports the static-class message", () => {
        expect(hitsFor(rule, "export class ServiceImpl {}")[0]?.rule.message).toBe("Static-only class detected. Convert to module-level functions.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
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
    test("reports the double-cast message", () => {
        expect(hitsFor(rule, "const x = value as unknown as string;")[0]?.rule.message).toBe("Double cast via `as unknown as T` bypasses type safety. Use assertion functions or proper typing.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
});
describe("no-expect-typeof-tobe", () => {
    const rule = "no-expect-typeof-tobe";
    test("flags expect(typeof x).toBe(", () => {
        expect(matchesRule(rule, "expect(typeof value).toBe('string');")).toHaveLength(1);
    });
    test("flags a space between expect and the paren", () => {
        expect(matchesRule(rule, "expect (typeof value).toBe('string');")).toHaveLength(1);
    });
    test("flags a space before .toBe", () => {
        expect(matchesRule(rule, "expect(typeof value) .toBe('string');")).toHaveLength(1);
    });
    test("flags a space between toBe and the paren", () => {
        expect(matchesRule(rule, "expect(typeof value).toBe ('string');")).toHaveLength(1);
    });
    test("flags extra spaces inside expect(typeof)", () => {
        expect(matchesRule(rule, "expect( typeof  value ).toBe( 'string' );")).toHaveLength(1);
    });
    test("ignores expect(value).toBe( without typeof", () => {
        expect(matchesRule(rule, "expect(value).toBe('string');")).toHaveLength(0);
    });
    test("reports the typeof message", () => {
        expect(hitsFor(rule, "expect(typeof value).toBe('string');")[0]?.rule.message).toBe("Unexpected `expect(typeof x).toBe()`. Use TypeScript types or schema assertions instead of runtime type checks.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
});
describe("no-toBeInstanceOf", () => {
    const rule = "no-toBeInstanceOf";
    test("flags .toBeInstanceOf(", () => {
        expect(matchesRule(rule, "expect(err).toBeInstanceOf(Error);")).toHaveLength(1);
    });
    test("flags a space before the paren", () => {
        expect(matchesRule(rule, "expect(err).toBeInstanceOf (Error);")).toHaveLength(1);
    });
    test("ignores toBeInstanceOf without leading dot", () => {
        expect(matchesRule(rule, "const toBeInstanceOf = noop;")).toHaveLength(0);
    });
    test("allows toBeInstanceOf(ArkErrors)", () => {
        expect(matchesRule(rule, "expect(err).toBeInstanceOf(ArkErrors);")).toHaveLength(0);
    });
    test("reports the instance message", () => {
        expect(hitsFor(rule, "expect(err).toBeInstanceOf(Error);")[0]?.rule.message).toBe("Unexpected `toBeInstanceOf()`. Use behavior-focused assertions instead of checking constructor types.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
});
describe("no-raw-response-in-elysia", () => {
    const rule = "no-raw-response-in-elysia";
    test("flags new Response( without proc.stdout", () => {
        expect(matchesRule(rule, "return new Response(JSON.stringify(data));")).toHaveLength(1);
    });
    test("flags a space before the paren", () => {
        expect(matchesRule(rule, "return new Response (JSON.stringify(data));")).toHaveLength(1);
    });
    test("ignores new Response(proc. (Bun stream read exemption)", () => {
        expect(matchesRule(rule, "const text = new Response(proc.stdout).text();")).toHaveLength(0);
    });
    test("reports the response message", () => {
        expect(hitsFor(rule, "return new Response(JSON.stringify(data));")[0]?.rule.message).toBe("Unexpected `new Response()`. Use set.status, set.headers, and redirect() in Elysia handlers.");
    });
    test("severity is warning", () => {
        expect(ruleByName(rule).severity).toBe("warning");
    });
    test("flags new Response when the file imports elysia", async () => {
        const violations = await scanFile("handler.ts", {
            readFile: () => Promise.resolve('import { Elysia } from "elysia";\nreturn new Response(JSON.stringify(data));\n'),
        });
        const hits = violations.filter((violation) => violation.rule.name === rule);
        expect(hits).toHaveLength(1);
    });
    test("skips new Response when the file does not import elysia", async () => {
        const violations = await scanFile("handler.ts", {
            readFile: () => Promise.resolve("return new Response(JSON.stringify(data));\n"),
        });
        expect(violations.filter((violation) => violation.rule.name === rule)).toEqual([]);
    });
    test("fileGuard accepts a single-quoted elysia import", () => {
        expect(ruleByName(rule).fileGuard?.("import { Elysia } from 'elysia'")).toBe(true);
    });
});
describe("no-raw-locator-in-spec", () => {
    const rule = "no-raw-locator-in-spec";
    test("flags page.locator( in spec content", () => {
        expect(matchesRule(rule, "const btn = page.locator('button');")).toHaveLength(1);
    });
    test("flags a space before the paren", () => {
        expect(matchesRule(rule, "const btn = page.locator ('button');")).toHaveLength(1);
    });
    test("ignores page.getByRole( (POM-friendly locator)", () => {
        expect(matchesRule(rule, "const btn = page.getByRole('button');")).toHaveLength(0);
    });
    test("reports the locator message", () => {
        expect(hitsFor(rule, "const btn = page.locator('button');")[0]?.rule.message).toBe("Raw page.locator() in spec file. Encapsulate in a POM method instead.");
    });
    test("severity is error", () => {
        expect(ruleByName(rule).severity).toBe("error");
    });
    test("flags page.locator when the file calls test.describe", async () => {
        const violations = await scanFile("sample.spec.ts", {
            readFile: () => Promise.resolve("test.describe('suite', () => {\nconst btn = page.locator('button');\n"),
        });
        expect(violations.filter((violation) => violation.rule.name === rule)).toHaveLength(1);
    });
    test("flags page.locator when describe has a space before the paren", async () => {
        const violations = await scanFile("sample.spec.ts", {
            readFile: () => Promise.resolve("test.describe ('suite', () => {\nconst btn = page.locator('button');\n"),
        });
        expect(violations.filter((violation) => violation.rule.name === rule)).toHaveLength(1);
    });
    test("skips page.locator when the file has no test.describe", async () => {
        const violations = await scanFile("pom.ts", {
            readFile: () => Promise.resolve("const btn = page.locator('button');\n"),
        });
        expect(violations.filter((violation) => violation.rule.name === rule)).toEqual([]);
    });
});
function matchesRule(ruleName: string, line: string): RegExpMatchArray[] {
    return [...line.matchAll(ruleByName(ruleName).pattern)];
}
function ruleByName(ruleName: string): Rule {
    const rule = RULES.find((candidate) => candidate.name === ruleName);
    if (!rule)
        throw new Error(`Rule not found: ${ruleName}`);
    return rule;
}
function hitsFor(ruleName: string, line: string): Violation[] {
    const violations: Violation[] = [];
    checkLineForViolations({
        line,
        lineIndex: 0,
        filePath: "sample.ts",
        violations,
    });
    return violations.filter((violation) => violation.rule.name === ruleName);
}
