import { promises as fs } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { isFileExcludedForRule, type ProjectConfig } from "./config.ts";
import { RULES } from "./rules";

export interface FileReader {
	readFile(path: string): Promise<string>;
}

export const bunFileReader: FileReader = {
	readFile: (path: string) => Bun.file(path).text(),
};

export function exitWithResult(
	errorCount: number,
	warningCount: number,
	fileCount?: number,
): never {
	if (errorCount > 0) {
		printSummaryReport(errorCount, warningCount);
		console.log(pc.red("Fix errors before proceeding."));
		process.exit(1);
	} else if (warningCount > 0) {
		printSummaryReport(errorCount, warningCount);
		console.log(pc.yellow("Consider fixing warnings for better compliance."));
		process.exit(0);
	} else {
		const files = fileCount ?? 0;
		const rules = RULES.length;
		console.log(pc.green(`All ${files} files passed (${rules} rules checked).`));
		process.exit(0);
	}
}
export async function scanFiles(
	pattern: string,
	options: ScanOptions & { json: true },
): Promise<ScanResult & { violations: JsonViolation[] }>;
export async function scanFiles(pattern: string, options?: ScanOptions): Promise<ScanResult>;
export async function scanFiles(pattern: string, options?: ScanOptions): Promise<ScanResult> {
	const opts = applyScanDefaults(options);
	let errorCount = 0;
	let warningCount = 0;
	let fileCount = 0;
	const collected: JsonViolation[] = [];
	const displayViolations: DisplayViolation[] = [];
	for await (const file of fs.glob(pattern, { exclude: opts.excludePatterns })) {
		if (!shouldProcessFile(file, opts.excludeName)) continue;
		fileCount++;
		const violations: Violation[] = await scanFile(file, bunFileReader, opts.ruleExcludes);
		if (violations.length === 0) continue;
		const relFile = path.relative(process.cwd(), file);
		const context = { violations, relFile, collected, displayViolations, json: opts.json };
		collectViolations(context);
		const counts = countSeverities(violations);
		errorCount += counts.errors;
		warningCount += counts.warnings;
	}
	return {
		errorCount,
		warningCount,
		fileCount,
		violations: opts.json ? collected : undefined,
		displayViolations,
	};
}
function collectViolations(context: {
	violations: Violation[];
	relFile: string;
	collected: JsonViolation[];
	displayViolations: DisplayViolation[];
	json: boolean | undefined;
}): void {
	if (context.json) {
		for (const v of context.violations) context.collected.push(toJsonViolation(context.relFile, v));
	}
	for (const v of context.violations) {
		context.displayViolations.push({
			line: v.line,
			column: v.column,
			rule: v.rule,
			match: v.match,
			sourceLine: v.sourceLine,
			file: context.relFile,
		});
	}
}
export async function scanFile(
	filePath: string,
	fileReader: FileReader = bunFileReader,
	ruleExcludes: Record<string, { exclude?: string[] }> = {},
): Promise<Violation[]> {
	const violations: Violation[] = [];
	const content: string = await fileReader.readFile(filePath);
	const lines: string[] = content.split("\n");
	const fileSkippedRules = new Set(
		RULES.filter((r) => r.fileGuard && !r.fileGuard(content)).map((r) => r.name),
	);
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
			ruleExcludes,
			fileSkippedRules,
		});
	}
	return violations;
}
export function checkLineForViolations(params: CheckLineParams): void {
	const { line, lineIndex, filePath, violations, ruleExcludes = {}, fileSkippedRules } = params;
	const relPath = path.relative(process.cwd(), filePath);
	for (const rule of RULES) {
		if (fileSkippedRules?.has(rule.name)) continue;
		if (isFileExcludedForRule(relPath, rule.name, ruleExcludes)) continue;
		const matches: RegExpMatchArray[] = [...line.matchAll(rule.pattern)];
		for (const match of matches) {
			violations.push({
				file: filePath,
				line: lineIndex + 1,
				column: (match.index ?? 0) + 1,
				rule,
				match: match[0],
				sourceLine: line,
			});
		}
	}
}

export function shouldProcessFile(file: string, excludeName?: string): boolean {
	const isValidExtension: boolean =
		file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx");
	const isNotSelf: boolean = excludeName ? !isSelfPath(file, excludeName) : true;
	return isValidExtension && isNotSelf;
}
function isSelfPath(file: string, excludeName: string): boolean {
	const segments = file.split("/");
	return segments.some((s) => s === excludeName || s.startsWith(`${excludeName}.`));
}
export function countBySeverity(violations: Violation[], severity: "error" | "warning"): number {
	const counts = countSeverities(violations);
	return severity === "error" ? counts.errors : counts.warnings;
}
function countSeverities(violations: Violation[]): { errors: number; warnings: number } {
	let errors = 0;
	let warnings = 0;
	for (const v of violations) {
		if (v.rule.severity === "error") errors++;
		else warnings++;
	}
	return { errors, warnings };
}
export interface PrintableViolation {
	line: number;
	column: number;
	rule: { name: string; message: string; severity: "error" | "warning" };
	match: string;
	sourceLine?: string;
}
export interface DisplayViolation extends PrintableViolation {
	file: string;
}
export function printViolations(file: string, violations: PrintableViolation[]): void {
	console.log(pc.dim(file));
	for (const v of violations) {
		const location = pc.dim(`  ${v.line}:${v.column}`);
		const severity = v.rule.severity === "error" ? pc.red("error") : pc.yellow("warning");
		const ruleName = pc.dim(v.rule.name);
		console.log(`${location}  ${severity}  ${v.rule.message}  ${ruleName}`);
		if (v.sourceLine) {
			console.log(pc.dim(`    ${v.sourceLine}`));
			console.log(pc.red(`    ${" ".repeat(v.column - 1)}${"~".repeat(v.match.length)}`));
		}
	}
	console.log("");
}
function toJsonViolation(file: string, v: Violation): JsonViolation {
	return {
		file,
		line: v.line,
		column: v.column,
		rule: v.rule.name,
		message: v.rule.message,
		severity: v.rule.severity,
		match: v.match,
	};
}
export function printSummaryReport(errorCount: number, warningCount: number): void {
	const total = errorCount + warningCount;
	const errors = errorCount > 0 ? pc.red(`${errorCount} errors`) : `${errorCount} errors`;
	const warnings =
		warningCount > 0 ? pc.yellow(`${warningCount} warnings`) : `${warningCount} warnings`;
	console.log(`\n${pc.bold(`${total} violations`)} (${errors}, ${warnings})`);
}
export interface Rule {
	name: string;
	pattern: RegExp;
	message: string;
	severity: "error" | "warning";
	fileGuard?: (content: string) => boolean;
}
export interface Violation {
	file: string;
	line: number;
	column: number;
	rule: Rule;
	match: string;
	sourceLine?: string;
}
export interface CheckLineParams {
	line: string;
	lineIndex: number;
	filePath: string;
	violations: Violation[];
	ruleExcludes?: Record<string, { exclude?: string[] }>;
	fileSkippedRules?: Set<string>;
}
export interface JsonViolation {
	file: string;
	line: number;
	column: number;
	rule: string;
	message: string;
	severity: "error" | "warning";
	match: string;
}
export interface ScanOptions {
	excludePatterns?: readonly string[];
	excludeName?: string;
	json?: boolean;
	config?: ProjectConfig;
}
export interface ScanResult {
	errorCount: number;
	warningCount: number;
	fileCount?: number;
	violations?: JsonViolation[];
	displayViolations?: DisplayViolation[];
}
const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = [
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
	"scripts/**",
	"**/__fixtures__/**",
];
function applyScanDefaults(options?: ScanOptions) {
	const base = options?.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
	const extra = options?.config?.exclude ?? [];
	return {
		excludePatterns: [...base, ...extra],
		excludeName: options?.excludeName ?? "rule-validator",
		json: options?.json,
		ruleExcludes: options?.config?.rules ?? {},
	};
}

export { RULES } from "./rules";
export * from "./rules/index";
export * from "./typescript/index";
