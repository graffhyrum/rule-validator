#!/usr/bin/env bun
import { exitWithResult, printSummaryReport, type ScanResult, scanFiles } from "./index.ts";

async function main() {
	const args: string[] = process.argv.slice(2);
	const pattern: string = args[0] || "**/*.{ts,tsx,js,jsx}";

	try {
		const { errorCount, warningCount }: ScanResult = await scanFiles(pattern);
		printSummaryReport(errorCount, warningCount);
		exitWithResult(errorCount, warningCount);
	} catch (error) {
		console.error("❌ Error scanning files:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		await main();
	} catch (e) {
		console.error(e);
	}
}
