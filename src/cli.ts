#!/usr/bin/env bun
import { exitWithResult, printSummaryReport, scanFiles } from "./index.ts";

async function main() {
	const args = process.argv.slice(2);
	const pattern = args[0] || "**/*.{ts,tsx,js,jsx}";

	console.log("🔍 Scanning for rule violations...\n");

	try {
		const { totalViolations, errorCount, warningCount } = await scanFiles(pattern);
		printSummaryReport(totalViolations, errorCount, warningCount);
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
