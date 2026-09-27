import { promises as fs } from "node:fs";
import pc from "picocolors";
import { isFileExcludedForRule, type ProjectConfig, type RuleExcludes } from "./config.ts";
import { REGEX_SCAN_DEFAULT_EXCLUDES } from "./exclude-patterns.ts";
import { type RelativePosixPath, toPosixPath, toRelativePosix } from "./paths.ts";
import { RULES, type Rule } from "./rules.ts";
import type { Severity } from "./rules/rule.ts";
import { classifyOutcome, outcomeExitCode, printRunFooter } from "./run-frame.ts";

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
	const outcome = classifyOutcome({
		errorCount,
		warningCount,
		fileCount: fileCount ?? 0,
		ruleCount: RULES.length,
	});
	if (outcome.kind !== "passed") printSummaryReport(errorCount, warningCount);
	printRunFooter(outcome);
	process.exit(outcomeExitCode(outcome));
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
		const relFile = toRelativePosix(file);
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
	relFile: RelativePosixPath;
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
	ruleExcludes: RuleExcludes = {},
): Promise<Violation[]> {
	const violations: Violation[] = [];
	const content: string = await fileReader.readFile(filePath);
	const lines: string[] = content.split("\n");
	const relPath = toRelativePosix(filePath);
	const fileSkippedRules = new Set(
		RULES.filter((r) => r.fileGuard && !r.fileGuard(content)).map((r) => r.name),
	);
	for (const rule of RULES) {
		if (isFileExcludedForRule(relPath, rule.name, ruleExcludes)) {
			fileSkippedRules.add(rule.name);
		}
	}
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
			fileSkippedRules,
			relPath,
		});
	}
	return violations;
}
export function checkLineForViolations(params: CheckLineParams): void {
	const { line, lineIndex, violations, ruleExcludes = {}, fileSkippedRules } = params;
	const relPath = params.relPath ?? toRelativePosix(params.filePath);
	for (const rule of RULES) {
		if (fileSkippedRules?.has(rule.name)) continue;
		if (
			Object.keys(ruleExcludes).length > 0 &&
			isFileExcludedForRule(relPath, rule.name, ruleExcludes)
		)
			continue;
		const matches: RegExpMatchArray[] = [...line.matchAll(rule.pattern)];
		for (const match of matches) {
			violations.push({
				file: relPath,
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
	const segments = toPosixPath(file).split("/");
	return segments.some((s) => s === excludeName || s.startsWith(`${excludeName}.`));
}
export function countBySeverity(violations: Violation[], severity: Severity): number {
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
	rule: { name: string; message: string; severity: Severity };
	match: string;
	sourceLine?: string;
}
export interface DisplayViolation extends PrintableViolation {
	file: RelativePosixPath;
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
function toJsonViolation(file: RelativePosixPath, v: Violation): JsonViolation {
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
	console.log(`${pc.bold(`${total} violations`)} (${errors}, ${warnings})`);
}
export type { Rule };
export interface Violation {
	file: RelativePosixPath;
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
	ruleExcludes?: RuleExcludes;
	fileSkippedRules?: Set<string>;
	relPath?: RelativePosixPath;
}
export interface JsonViolation {
	file: RelativePosixPath;
	line: number;
	column: number;
	rule: string;
	message: string;
	severity: Severity;
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
function applyScanDefaults(options?: ScanOptions) {
	const base = options?.excludePatterns ?? REGEX_SCAN_DEFAULT_EXCLUDES;
	const extra = options?.config?.exclude ?? [];
	return {
		excludePatterns: [...base, ...extra],
		excludeName: options?.excludeName ?? "rule-validator",
		json: options?.json,
		ruleExcludes: options?.config?.rules ?? {},
	};
}

export { RULES };
export * from "./rules/index";
export * from "./typescript/index";
