import { describe, expect, it } from "bun:test";
import * as ts from "typescript";
import type { AnalyzerContext } from "../typescript/compiler.js";
import { runRules } from "./runner.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";

function makeAnalyzer(files: Record<string, string>): AnalyzerContext {
	const sourceFiles = new Map<string, ts.SourceFile>();
	for (const [name, code] of Object.entries(files)) {
		sourceFiles.set(name, ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true));
	}
	return {
		program: {} as ts.Program,
		checker: {} as ts.TypeChecker,
		sourceFiles,
	};
}

describe("runRules", () => {
	it("returns empty array when sourceFiles map is empty", () => {
		const analyzer = makeAnalyzer({});
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		expect(results).toEqual([]);
	});

	it("returns separate results for each file containing violations", () => {
		const analyzer = makeAnalyzer({
			"a.ts": `const x = "hello" + name;`,
			"b.ts": `const y = "world" + name;`,
		});
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule] });
		expect(results.length).toBe(2);
		const files = results.map((r) => r.file).sort();
		expect(files).toEqual(["a.ts", "b.ts"]);
	});

	it("skips a rule for files matching ruleExcludes patterns", () => {
		const analyzer = makeAnalyzer({
			"src/utils.ts": `const x = "hello" + name;`,
		});
		const ruleExcludes = {
			"template-literals-only": { exclude: ["src/utils.ts"] },
		};
		const results = runRules({ analyzer, rules: [templateLiteralsOnlyRule], ruleExcludes });
		expect(results).toEqual([]);
	});

	it("excludes only the matching rule, not all rules", () => {
		const analyzer = makeAnalyzer({
			"src/code.ts": `const x = "hello" + name;\nconst y = value!;`,
		});
		const ruleExcludes = {
			"template-literals-only": { exclude: ["src/code.ts"] },
		};
		const results = runRules({
			analyzer,
			rules: [templateLiteralsOnlyRule, noNonNullAssertionRule],
			ruleExcludes,
		});
		const violations = results.flatMap((r) => r.violations);
		const ruleNames = violations.map((v) => v.rule.name);
		expect(ruleNames).not.toContain("template-literals-only");
		expect(ruleNames).toContain("no-non-null-assertion");
	});

	it("populates FoundViolation with severity, message, and code fields", () => {
		const analyzer = makeAnalyzer({
			"test.ts": `const x = value!;`,
		});
		const results = runRules({ analyzer, rules: [noNonNullAssertionRule] });
		expect(results.length).toBe(1);
		const violation = results[0]?.violations[0];
		expect(violation).toBeDefined();
		expect(violation?.severity).toBe("error");
		expect(violation?.message).toContain("non-null assertion");
		expect(violation?.code).toContain("value!");
		expect(violation?.location.line).toBeGreaterThan(0);
	});
});
