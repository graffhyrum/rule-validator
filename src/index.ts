import { RULES } from "./rules";

export interface FileReader {
	readFile(path: string): Promise<string>;
}

export const bunFileReader: FileReader = {
	readFile: (path: string) => Bun.file(path).text(),
};

export function exitWithResult(errorCount: number, warningCount: number): never {
	const totalCount: number = errorCount + warningCount;
	if (totalCount > 0) printSummaryReport(errorCount, warningCount);
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
export async function scanFiles(
	pattern: string,
	excludePatterns: readonly string[] = [
		"node_modules/**",
		"**/node_modules/**",
		"dist/**",
		"build/**",
		"playwright-report/**",
		"netlify/**",
		"**/*.test.ts",
		"**/*.test.tsx",
		"**/*.test.js",
		"**/*.test.jsx",
		"debug-cast.ts",
		"src/rules.ts",
		"src/rules/*.ts",
	],
	excludeName: string = "rule-validator",
): Promise<ScanResult> {
	let errorCount: number = 0;
	let warningCount: number = 0;
	const { promises } = await import("node:fs");
	const path = await import("node:path");
	for await (const file of promises.glob(pattern, {
		exclude: excludePatterns,
	})) {
		if (!shouldProcessFile(file, excludeName)) {
			continue;
		}
		const violations: Violation[] = await scanFile(file);
		if (violations.length > 0) {
			const relativePath: string = path.relative(process.cwd(), file);
			printViolations(relativePath, violations);
			errorCount += countBySeverity(violations, "error");
			warningCount += countBySeverity(violations, "warning");
		}
	}
	return { errorCount, warningCount };
}
export async function scanFile(
	filePath: string,
	fileReader: FileReader = bunFileReader,
): Promise<Violation[]> {
	const violations: Violation[] = [];
	const content: string = await fileReader.readFile(filePath);
	const lines: string[] = content.split("\n");
	for (let lineIndex: number = 0; lineIndex < lines.length; lineIndex++) {
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
export function checkLineForViolations(params: CheckLineParams): void {
	const { line, lineIndex, filePath, violations }: CheckLineParams = params;
	for (const rule of RULES) {
		const matches: RegExpMatchArray[] = [...line.matchAll(rule.pattern)];
		for (const match of matches) {
			violations.push({
				file: filePath,
				line: lineIndex + 1,
				column: match.index ?? 0,
				rule,
				match: match[0],
			});
		}
	}
}
export function shouldProcessFile(file: string, excludeName?: string): boolean {
	const isValidExtension: boolean =
		file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx");
	const isNotSelf: boolean = excludeName ? !file.includes(excludeName) : true;
	return isValidExtension && isNotSelf;
}
export function countBySeverity(violations: Violation[], severity: "error" | "warning"): number {
	return violations.filter((v: Violation) => v.rule.severity === severity).length;
}
export function printViolations(file: string, violations: Violation[]): void {
	const relativePath: string = file; // Caller should provide relative path
	console.log(`📁 ${relativePath} :`);
	for (const v of violations) {
		const icon: string = v.rule.severity === "error" ? "❌" : "⚠️";
		console.log(`  ${icon} ${relativePath}:${v.line}:${v.column} - ${v.rule.message}`);
		console.log(`    Found: ${v.match.trim()}`);
	}
	console.log("");
}
export function printSummaryReport(errorCount: number, warningCount: number): void {
	console.log(
		`📊 Summary: ${errorCount + warningCount} violations (${errorCount} errors, ${warningCount} warnings)`,
	);
}
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
export interface CheckLineParams {
	line: string;
	lineIndex: number;
	filePath: string;
	violations: Violation[];
}
export interface ScanResult {
	errorCount: number;
	warningCount: number;
}
export { RULES } from "./rules";
export * from "./rules/index";
export * from "./typescript/index";
