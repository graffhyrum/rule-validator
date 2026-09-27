// afterFileEdit: scan changed files after agent edits. Never block.
// Run with: bun .cursor/hooks/ubs-after-edit.ts

import { spawnSync } from "node:child_process";
import { type } from "arktype";
import { AfterFileEditInput, parseJson, readStdinText } from "./schema.ts";

function readInput(): void {
	const raw = readStdinText();
	if (raw.length === 0) return;
	try {
		const input = AfterFileEditInput(parseJson(raw));
		if (input instanceof type.errors) {
			process.stderr.write(`ubs hook: invalid afterFileEdit input: ${input.summary}\n`);
		}
	} catch {
		process.stderr.write("ubs hook: stdin is not JSON\n");
	}
}

function asCount(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
	if (typeof value !== "string" || value.trim().length === 0) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function totals(value: unknown): { critical: number; high: number } {
	if (typeof value !== "object" || value === null || !("scanners" in value)) {
		return { critical: 0, high: 0 };
	}
	const scanners = value.scanners;
	if (!Array.isArray(scanners)) return { critical: 0, high: 0 };
	let critical = 0;
	let high = 0;
	for (const scanner of scanners) {
		if (typeof scanner !== "object" || scanner === null) continue;
		if ("critical" in scanner) critical += asCount(scanner.critical);
		if ("high" in scanner) high += asCount(scanner.high);
	}
	return { critical, high };
}

function report(output: string): void {
	let counts = { critical: 0, high: 0 };
	try {
		counts = totals(JSON.parse(output) as unknown);
	} catch {
		return;
	}
	if (counts.critical === 0 && counts.high === 0) return;
	process.stderr.write(
		`⚠️ ubs: ${counts.critical} critical, ${counts.high} high findings in changed files. Fix before continuing.\n`,
	);
	process.stderr.write(`${output}\n`);
}

function main(): void {
	readInput();
	const result = spawnSync("ubs", ["--diff", "--format=json", "."], {
		encoding: "utf8",
		windowsHide: true,
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (result.error || typeof result.stdout !== "string") return;
	const output = result.stdout.trim();
	if (output.length === 0) return;
	report(output);
}

try {
	main();
} catch {
	// Never block the edit.
}
