import pc from "picocolors";

const FRAME_WIDTH = 64;
const MIN_RULE_FILL = 3;

export type RunOutcome =
	| {
			readonly kind: "passed";
			readonly fileCount: number;
			readonly ruleCount: number;
	  }
	| {
			readonly kind: "warnings";
			readonly warningCount: number;
	  }
	| {
			readonly kind: "errors";
			readonly errorCount: number;
			readonly warningCount: number;
	  }
	| {
			readonly kind: "crashed";
	  };

export type ExitCode = 0 | 1;

export type OutcomeCounts = {
	readonly errorCount: number;
	readonly warningCount: number;
	readonly fileCount: number;
	readonly ruleCount: number;
};

/** Footer, blank line → stdout. Call once, right before exit. */
export function printRunFooter(outcome: RunOutcome): void {
	console.log(formatRunFooter(outcome, FRAME_WIDTH));
	console.log("");
}

/** Blank line, header, blank line → stdout. */
export function printRunHeader(): void {
	console.log("");
	console.log(formatRunHeader(FRAME_WIDTH));
	console.log("");
}

export function formatRunFooter(outcome: RunOutcome, width: number): string {
	switch (outcome.kind) {
		case "passed":
			return pc.green(
				frameRuleLine(
					`✔ All ${outcome.fileCount} files passed (${outcome.ruleCount} rules checked).`,
					width,
				),
			);
		case "warnings":
			return pc.yellow(frameRuleLine("⚠ Consider fixing warnings for better compliance.", width));
		case "errors":
			return pc.red(frameRuleLine("✖ Fix errors before proceeding.", width));
		case "crashed":
			return pc.red(frameRuleLine("✖ Run failed.", width));
		default: {
			const _exhaustive: never = outcome;
			throw new Error(`unhandled outcome: ${JSON.stringify(_exhaustive)}`);
		}
	}
}

export function formatRunHeader(width: number): string {
	return pc.dim(frameRuleLine("rule-validator", width));
}

export function classifyOutcome(counts: OutcomeCounts): Exclude<RunOutcome, { kind: "crashed" }> {
	if (counts.errorCount > 0) {
		return {
			kind: "errors",
			errorCount: counts.errorCount,
			warningCount: counts.warningCount,
		};
	}
	if (counts.warningCount > 0) {
		return { kind: "warnings", warningCount: counts.warningCount };
	}
	return { kind: "passed", fileCount: counts.fileCount, ruleCount: counts.ruleCount };
}

export function outcomeExitCode(outcome: RunOutcome): ExitCode {
	switch (outcome.kind) {
		case "passed":
		case "warnings":
			return 0;
		case "errors":
		case "crashed":
			return 1;
		default: {
			const _exhaustive: never = outcome;
			throw new Error(`unhandled outcome: ${JSON.stringify(_exhaustive)}`);
		}
	}
}

function frameRuleLine(label: string, width: number): string {
	const head = `── ${label} `;
	return `${head}${"─".repeat(Math.max(MIN_RULE_FILL, width - head.length))}`;
}
