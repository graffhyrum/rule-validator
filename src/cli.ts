#!/usr/bin/env bun
import { createCommand } from "commander";
import packageJson from "../package.json";
import { type AstScanOptions, runAstRules } from "./ast-scan.ts";
import { loadProjectConfig, type ProjectConfig } from "./config.ts";
import {
	type DisplayViolation,
	exitWithResult,
	type JsonViolation,
	type PrintableViolation,
	printViolations,
	type ScanOptions,
	type ScanResult,
	scanFiles,
} from "./index.ts";
import { toRelativePosix } from "./paths.ts";
import { printRunFooter, printRunHeader } from "./run-frame.ts";

const DEFAULT_PATTERN = "**/*.{ts,tsx,js,jsx}";

export interface CliDeps {
	loadProjectConfig: (startDir?: string) => Promise<ProjectConfig>;
	scanFiles: (pattern: string, options?: ScanOptions) => Promise<ScanResult>;
	runAstRules: (pattern: string, options?: AstScanOptions) => Promise<ScanResult>;
	printViolations: (file: string, violations: PrintableViolation[]) => void;
	exitWithResult: (errorCount: number, warningCount: number, fileCount?: number) => never;
}

const defaultDeps: CliDeps = {
	loadProjectConfig,
	scanFiles,
	runAstRules,
	printViolations,
	exitWithResult,
};

type CombinedScanResult = {
	errorCount: number;
	warningCount: number;
	fileCount: number;
	violations: JsonViolation[] | DisplayViolation[];
};

export async function main(argv?: string[], deps: CliDeps = defaultDeps): Promise<void> {
	const program = buildProgram();
	program.parse(argv ?? process.argv);
	const opts = program.opts<{ json?: boolean }>();
	const pattern: string = program.args[0] || DEFAULT_PATTERN;

	try {
		if (!opts.json) printRunHeader();
		const config = await deps.loadProjectConfig();
		const [regex, ast]: [ScanResult, ScanResult] = await Promise.all([
			deps.scanFiles(pattern, { json: opts.json, config }),
			deps.runAstRules(pattern, { json: opts.json, config }),
		]);
		const combined = deduplicateAndPrint(regex, ast, {
			shouldPrint: !opts.json,
			printViolations: deps.printViolations,
		});
		if (opts.json) {
			outputJsonAndExit(combined);
		}
		deps.exitWithResult(combined.errorCount, combined.warningCount, combined.fileCount);
	} catch (error) {
		console.error("Error scanning files:", errorText(error));
		if (!opts.json) printRunFooter({ kind: "crashed" });
		process.exit(1);
	}
}

export async function guardEntry(entry: () => Promise<void>): Promise<void> {
	try {
		await entry();
	} catch (error) {
		console.error(errorText(error));
		process.exit(1);
	}
}

export function errorText(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

if (import.meta.main) {
	await guardEntry(main);
}

function deduplicateAndPrint(
	regex: ScanResult,
	ast: ScanResult,
	output: { shouldPrint: boolean; printViolations: CliDeps["printViolations"] },
): CombinedScanResult {
	const regexDisplay = regex.displayViolations ?? [];
	const astDisplay = ast.displayViolations ?? [];
	const dedupedDisplay = deduplicateDisplayViolations(regexDisplay, astDisplay);
	if (output.shouldPrint && dedupedDisplay.length > 0) {
		printDedupedDisplay(dedupedDisplay, output.printViolations);
	}
	const regexViolations = regex.violations ?? [];
	const astViolations = ast.violations ?? [];
	const dedupedJson = deduplicateJsonViolations(regexViolations, astViolations);
	const combinedCounts = selectCounts({
		dedupedDisplay,
		dedupedJson,
		regex,
		ast,
	});
	return {
		errorCount: combinedCounts.errorCount,
		warningCount: combinedCounts.warningCount,
		fileCount: (regex.fileCount ?? 0) + (ast.fileCount ?? 0),
		violations: dedupedJson.length > 0 ? dedupedJson : dedupedDisplay,
	};
}

function selectCounts(context: {
	dedupedDisplay: DisplayViolation[];
	dedupedJson: JsonViolation[];
	regex: ScanResult;
	ast: ScanResult;
}): { errorCount: number; warningCount: number } {
	if (context.dedupedDisplay.length > 0) return countFromDisplayViolations(context.dedupedDisplay);
	if (context.dedupedJson.length > 0) return countFromJsonViolations(context.dedupedJson);
	return {
		errorCount: context.regex.errorCount + context.ast.errorCount,
		warningCount: context.regex.warningCount + context.ast.warningCount,
	};
}

export function deduplicateDisplayViolations(
	regexDisplay: DisplayViolation[],
	astDisplay: DisplayViolation[],
): DisplayViolation[] {
	const deduped = new Map<string, DisplayViolation>();
	for (const v of regexDisplay) {
		const normalizedFile = toRelativePosix(v.file);
		const key = `${normalizedFile}:${v.line}:${v.column}:${v.rule.name}`;
		deduped.set(key, { ...v, file: normalizedFile });
	}
	for (const v of astDisplay) {
		const normalizedFile = toRelativePosix(v.file);
		const key = `${normalizedFile}:${v.line}:${v.column}:${v.rule.name}`;
		if (!deduped.has(key)) {
			deduped.set(key, { ...v, file: normalizedFile });
		}
	}
	return Array.from(deduped.values());
}

function printDedupedDisplay(
	violations: DisplayViolation[],
	print: CliDeps["printViolations"],
): void {
	const sorted = [...violations].sort((a, b) => {
		if (a.file !== b.file) return a.file.localeCompare(b.file);
		if (a.line !== b.line) return a.line - b.line;
		return a.column - b.column;
	});
	const byFile = new Map<string, DisplayViolation[]>();
	for (const v of sorted) {
		if (!byFile.has(v.file)) byFile.set(v.file, []);
		const group = byFile.get(v.file);
		if (group) group.push(v);
	}
	for (const [file, viols] of byFile) {
		const printable = viols.map((v) => ({
			line: v.line,
			column: v.column,
			rule: v.rule,
			match: v.match,
			sourceLine: v.sourceLine,
		}));
		print(file, printable);
	}
}

function countFromDisplayViolations(violations: DisplayViolation[]): {
	errorCount: number;
	warningCount: number;
} {
	let errorCount = 0;
	let warningCount = 0;
	for (const v of violations) {
		if (v.rule.severity === "error") errorCount++;
		else warningCount++;
	}
	return { errorCount, warningCount };
}

function countFromJsonViolations(violations: JsonViolation[]): {
	errorCount: number;
	warningCount: number;
} {
	let errorCount = 0;
	let warningCount = 0;
	for (const v of violations) {
		if (v.severity === "error") errorCount++;
		else warningCount++;
	}
	return { errorCount, warningCount };
}

export function deduplicateJsonViolations(
	regexViolations: JsonViolation[],
	astViolations: JsonViolation[],
): JsonViolation[] {
	const deduped = new Map<string, JsonViolation>();
	for (const v of regexViolations) {
		const file = toRelativePosix(v.file);
		const key = `${file}:${v.line}:${v.column}:${v.rule}`;
		deduped.set(key, { ...v, file });
	}
	for (const v of astViolations) {
		const file = toRelativePosix(v.file);
		const key = `${file}:${v.line}:${v.column}:${v.rule}`;
		if (!deduped.has(key)) {
			deduped.set(key, { ...v, file });
		}
	}
	return Array.from(deduped.values());
}

function outputJsonAndExit(result: CombinedScanResult): never {
	console.log(JSON.stringify(result));
	process.exit(result.errorCount > 0 ? 1 : 0);
}

function buildProgram() {
	const program = createCommand("rule-validator");
	program.description("Validate TypeScript/JavaScript files against lint rules");
	program.version(packageJson.version, "-V, --version");
	program.argument("[pattern]", "glob pattern for files to scan", DEFAULT_PATTERN);
	program.option("--json", "output results as JSON");
	return program;
}
