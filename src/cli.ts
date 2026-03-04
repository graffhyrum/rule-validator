#!/usr/bin/env bun
import path from "node:path";
import { createCommand } from "commander";
import { runAstRules } from "./ast-scan.ts";
import { loadProjectConfig } from "./config.ts";
import {
	type DisplayViolation,
	exitWithResult,
	type JsonViolation,
	printViolations,
	type ScanResult,
	scanFiles,
} from "./index.ts";

const DEFAULT_PATTERN = "**/*.{ts,tsx,js,jsx}";

export async function main(argv?: string[]): Promise<void> {
	const program = buildProgram();
	program.parse(argv ?? process.argv);
	const opts = program.opts<{ json?: boolean }>();
	const pattern: string = program.args[0] || DEFAULT_PATTERN;

	try {
		const config = await loadProjectConfig();
		const [regex, ast]: [ScanResult, ScanResult] = await Promise.all([
			scanFiles(pattern, { json: opts.json, config }),
			runAstRules(pattern, { json: opts.json, config }),
		]);
		const combined = deduplicateAndPrint(regex, ast, !opts.json);
		if (opts.json) {
			outputJsonAndExit(combined);
		}
		exitWithResult(combined.errorCount, combined.warningCount, combined.fileCount);
	} catch (error) {
		console.error("Error scanning files:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		await main();
	} catch (e) {
		console.error(e instanceof Error ? e.message : e);
	}
}

function deduplicateAndPrint(
	regex: ScanResult,
	ast: ScanResult,
	shouldPrint: boolean = true,
): {
	errorCount: number;
	warningCount: number;
	fileCount: number;
	violations: unknown[];
} {
	const regexDisplay = regex.displayViolations ?? [];
	const astDisplay = ast.displayViolations ?? [];
	const dedupedDisplay = deduplicateDisplayViolations(regexDisplay, astDisplay);
	if (shouldPrint && dedupedDisplay.length > 0) printDedupedDisplay(dedupedDisplay);
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
	const allDisplay = [...regexDisplay, ...astDisplay];
	const deduped = new Map<string, DisplayViolation>();
	for (const v of allDisplay) {
		const normalizedFile = path.isAbsolute(v.file) ? path.relative(process.cwd(), v.file) : v.file;
		const key = `${normalizedFile}:${v.line}:${v.column}:${v.rule.name}`;
		const existing = deduped.get(key);
		if (!existing || v.sourceLine) {
			deduped.set(key, { ...v, file: normalizedFile });
		}
	}
	return Array.from(deduped.values());
}

function printDedupedDisplay(violations: DisplayViolation[]): void {
	const sorted = violations.sort((a, b) => {
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
		printViolations(file, printable);
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
		const key = `${v.file}:${v.line}:${v.column}:${v.rule}`;
		deduped.set(key, v);
	}
	for (const v of astViolations) {
		const key = `${v.file}:${v.line}:${v.column}:${v.rule}`;
		if (!deduped.has(key)) {
			deduped.set(key, v);
		}
	}
	return Array.from(deduped.values());
}

function outputJsonAndExit(result: {
	errorCount: number;
	warningCount: number;
	fileCount: number;
	violations: unknown[];
}): never {
	console.log(JSON.stringify(result));
	process.exit(result.errorCount > 0 ? 1 : 0);
}

function buildProgram() {
	const { version } = require("../package.json");
	const program = createCommand("rule-validator");
	program.description("Validate TypeScript/JavaScript files against lint rules");
	program.version(version, "-V, --version");
	program.argument("[pattern]", "glob pattern for files to scan", DEFAULT_PATTERN);
	program.option("--json", "output results as JSON");
	return program;
}
