import { describe, expect, it } from "bun:test";
import path from "node:path";
import * as ts from "typescript";
import type { AnalyzerContext } from "../typescript/compiler.js";
import { noAnyTypesRule } from "./no-any-types.js";
import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";
import { noStaticClassesRule } from "./no-static-classes.js";
import { noToBeInstanceOfRule } from "./no-to-be-instance-of.js";
import { noUnknownAsCastRule } from "./no-unknown-as-cast.js";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";
import type { ASTRule } from "./rule.js";
import { runRules } from "./runner.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";

const ALL_RULES: ASTRule[] = [
	noAnyTypesRule,
	noExpectTypeofToBeRule,
	noNonNullAssertionRule,
	noStaticClassesRule,
	noToBeInstanceOfRule,
	noUnknownAsCastRule,
	noWaitForTimeoutRule,
	templateLiteralsOnlyRule,
];

describe("integration: rule engine against fixture files", () => {
	it("should find violations in known-bad fixture", async () => {
		const analyzer = await createFixtureAnalyzer("known-bad.ts");
		const results = runRules({ analyzer, rules: ALL_RULES });

		expect(results.length).toBe(1);

		const firstResult = results[0];
		expect(firstResult).toBeDefined();
		const violations = firstResult?.violations ?? [];
		const ruleNames = new Set(violations.map((v) => v.rule.name));

		expect(ruleNames.has("no-any-types")).toBe(true);
		expect(ruleNames.has("no-non-null-assertion")).toBe(true);
		expect(ruleNames.has("no-unknown-as-cast")).toBe(true);
		expect(ruleNames.has("no-static-classes")).toBe(true);
		expect(ruleNames.has("template-literals-only")).toBe(true);
		expect(ruleNames.has("no-waitForTimeout")).toBe(true);
		expect(ruleNames.has("no-expect-typeof-tobe")).toBe(true);
		expect(ruleNames.has("no-toBeInstanceOf")).toBe(true);
	});

	it("should find zero violations in known-good fixture", async () => {
		const analyzer = await createFixtureAnalyzer("known-good.ts");
		const results = runRules({ analyzer, rules: ALL_RULES });

		const violations = results.flatMap((r) => r.violations);
		expect(violations).toEqual([]);
	});
});

async function createFixtureAnalyzer(filename: string): Promise<AnalyzerContext> {
	const fixturePath = path.join(import.meta.dir, "__fixtures__", filename);
	const content = await Bun.file(fixturePath).text();
	const sourceFile = ts.createSourceFile(fixturePath, content, ts.ScriptTarget.Latest, true);
	const sourceFiles = new Map<string, ts.SourceFile>([[fixturePath, sourceFile]]);
	return {
		program: {} as ts.Program,
		checker: {} as ts.TypeChecker,
		sourceFiles,
	};
}
