import pc from "picocolors";
const FRAME_WIDTH = 64;
/**
 * Terminal verdict of one run. Single source of truth for footer text,
 * footer colour, and process exit code.
 * Invariant: "warnings" implies errorCount === 0 (encoded by omitting errorCount).
 */
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
/** Pure. Footer rule line carrying the verdict. Coloured by outcome. */
export function formatRunFooter(outcome: RunOutcome, width: number): string {
	switch (outcome.kind) {
		case "passed":
			return pc.green(
				rule(
					`✔ All ${outcome.fileCount} files passed (${outcome.ruleCount} rules checked).`,
					width,
				),
			);
		case "warnings":
			return pc.yellow(rule("⚠ Consider fixing warnings for better compliance.", width));
		case "errors":
			return pc.red(rule("✖ Fix errors before proceeding.", width));
		case "crashed":
			return pc.red(rule("✖ Run failed.", width));
		default: {
			const _exhaustive: never = outcome;
			throw new Error(`unhandled outcome: ${JSON.stringify(_exhaustive)}`);
		}
	}
}
/** Pure. Header rule line (no surrounding blanks). Dim. Tool name only. */
export function formatRunHeader(width: number): string {
	return pc.dim(rule("rule-validator", width));
}
/** Pure. Counts → outcome. errors dominate warnings dominate pass. */
// Four counts are the domain inputs; packing them obscures the call site.
// eslint-disable-next-line max-params -- domain counts stay positional
export function classifyOutcome(
	errorCount: number,
	warningCount: number,
	fileCount: number,
	ruleCount: number,
): Exclude<
	RunOutcome,
	{
		kind: "crashed";
	}
> {
	if (errorCount > 0) {
		return { kind: "errors", errorCount, warningCount };
	}
	if (warningCount > 0) {
		return { kind: "warnings", warningCount };
	}
	return { kind: "passed", fileCount, ruleCount };
}
/** Pure. Exhaustive switch with `never` default. */
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
/** Build `── ${label} ` then pad with ─ to width (min 3; never truncate label). */
function rule(label: string, width: number): string {
	const head = `── ${label} `;
	return `${head}${"─".repeat(Math.max(3, width - head.length))}`;
}
