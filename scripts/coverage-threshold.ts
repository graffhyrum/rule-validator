// Runs bun test --coverage and fails if any per-file function coverage drops below THRESHOLD.
// Exit 1 on threshold violation; exit 2 on test suite failure.

const THRESHOLD = 90;

const proc = Bun.spawn(["bun", "test", "--coverage"], {
	stdout: "pipe",
	stderr: "inherit",
	env: { ...process.env },
});

const raw = await new Response(proc.stdout).text();
process.stdout.write(raw);

const exitCode = await proc.exited;

if (exitCode !== 0) process.exit(2);

checkThreshold(raw);

function checkThreshold(output: string) {
	const failures = collectFailures(output);
	reportAndExit(failures);
}

function collectFailures(output: string): string[] {
	return output
		.split("\n")
		.flatMap((line) => parseLine(line))
		.filter((f) => f !== null) as string[];
}

function parseLine(line: string): string | null {
	const match = line.match(/^\s+(src\/\S+)\s+\|\s+([\d.]+)\s+\|/);
	if (!match || match[1] === undefined || match[2] === undefined) return null;
	const pct = Number.parseFloat(match[2]);
	if (pct < THRESHOLD) return `${match[1]}: ${pct}% functions (threshold: ${THRESHOLD}%)`;
	return null;
}

function reportAndExit(failures: string[]) {
	if (failures.length === 0) return;
	console.error(`\nCoverage threshold failed (${THRESHOLD}% functions required):`);
	for (const f of failures) console.error(`  ${f}`);
	process.exit(1);
}
