// Rule Compliance Validator - Library
// Scans code for violations of AGENTS.md rules

export interface Rule {
	name: string;
	pattern: RegExp;
	message: string;
	severity: "error" | "warning";
}

export interface Violation {
	file: string;
	line: number;
	column: number;
	rule: Rule;
	match: string;
}

export const RULES: Rule[] = [
	{
		name: "no-waitForTimeout",
		pattern: /\bwaitForTimeout\s*\(/g,
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

export interface CheckLineParams {
	line: string;
	lineIndex: number;
	filePath: string;
	violations: Violation[];
}

export function checkLineForViolations(params: CheckLineParams): void {
	const { line, lineIndex, filePath, violations } = params;
	for (const rule of RULES) {
		const matches = [...line.matchAll(rule.pattern)];
		for (const match of matches) {
			violations.push({
				file: filePath,
				line: lineIndex + 1,
				column: match.index || 0,
				rule,
				match: match[0],
			});
		}
	}
}

export async function scanFile(filePath: string): Promise<Violation[]> {
	const violations: Violation[] = [];
	const content = await Bun.file(filePath).text();
	const lines = content.split("\n");

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) {
			continue;
		}
		checkLineForViolations({
			line,
			lineIndex,
			filePath,
			violations,
		});
	}

	return violations;
}

export function shouldProcessFile(file: string, excludeName?: string): boolean {
	const isValidExtension =
		file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx");
	const isNotSelf = excludeName ? !file.includes(excludeName) : true;
	return isValidExtension && isNotSelf;
}

export function countBySeverity(violations: Violation[], severity: "error" | "warning"): number {
	return violations.filter((v) => v.rule.severity === severity).length;
}

export function printViolations(file: string, violations: Violation[]): void {
	const relativePath = file; // Caller should provide relative path
	console.log(`📁 ${relativePath} :`);
	for (const v of violations) {
		const icon = v.rule.severity === "error" ? "❌" : "⚠️";
		console.log(`  ${icon} ${relativePath}:${v.line}:${v.column} - ${v.rule.message}`);
		console.log(`    Found: ${v.match.trim()}`);
	}
	console.log("");
}

export function printSummaryReport(
	totalViolations: number,
	errorCount: number,
	warningCount: number,
): void {
	console.log(
		`📊 Summary: ${totalViolations} violations (${errorCount} errors, ${warningCount} warnings)`,
	);
}

export interface ScanResult {
	totalViolations: number;
	errorCount: number;
	warningCount: number;
}

export async function scanFiles(
	pattern: string,
	excludePatterns: string[] = [
		"node_modules/**",
		"**/node_modules/**",
		"dist/**",
		"build/**",
		"playwright-report/**",
		"netlify/**",
	],
	excludeName: string = "rule-validator",
): Promise<ScanResult> {
	let totalViolations = 0;
	let errorCount = 0;
	let warningCount = 0;

	const { promises } = await import("node:fs");
	const path = await import("node:path");

	for await (const file of promises.glob(pattern, {
		exclude: excludePatterns,
	})) {
		if (!shouldProcessFile(file, excludeName)) {
			continue;
		}

		const violations = await scanFile(file);
		if (violations.length > 0) {
			const relativePath = path.relative(process.cwd(), file);
			printViolations(relativePath, violations);
			totalViolations += violations.length;
			errorCount += countBySeverity(violations, "error");
			warningCount += countBySeverity(violations, "warning");
		}
	}

	return { totalViolations, errorCount, warningCount };
}

export function exitWithResult(errorCount: number, warningCount: number): never {
	if (errorCount > 0) {
		console.log("\n🚫 Errors found! Fix before proceeding.");
		process.exit(1);
	} else if (warningCount > 0) {
		console.log("\n⚠️ Warnings found. Consider fixing for better compliance.");
		process.exit(0);
	} else {
		process.exit(0);
	}
}
