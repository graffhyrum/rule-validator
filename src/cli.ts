#!/usr/bin/env bun
import { createCommand } from "commander";
import { runAstRules } from "./ast-scan.ts";
import { exitWithResult, type ScanResult, scanFiles } from "./index.ts";

const DEFAULT_PATTERN = "**/*.{ts,tsx,js,jsx}";

export async function main(argv?: string[]): Promise<void> {
	const program = buildProgram();
	program.parse(argv ?? process.argv);
	const opts = program.opts<{ json?: boolean }>();
	const pattern: string = program.args[0] || DEFAULT_PATTERN;

	try {
		const regex: ScanResult = await scanFiles(pattern, { json: opts.json });
		const ast: ScanResult = await runAstRules(pattern, opts.json);
		const combined = combineResults(regex, ast);
		if (opts.json) {
			outputJson(combined);
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

function combineResults(regex: ScanResult, ast: ScanResult) {
	return {
		errorCount: regex.errorCount + ast.errorCount,
		warningCount: regex.warningCount + ast.warningCount,
		fileCount: (regex.fileCount ?? 0) + (ast.fileCount ?? 0),
		violations: [...(regex.violations ?? []), ...(ast.violations ?? [])],
	};
}

function outputJson(result: {
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
