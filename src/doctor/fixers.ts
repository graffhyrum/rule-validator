// Fixers: run only under --fix, only after detectors report an autoFixable
// finding, only through mutate(). Pass 1 ships exactly one fixer.
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathExists } from "./fs-utils.ts";
import { mutate, MutateError } from "./mutate.ts";
import type { RunContext } from "./run-artifact.ts";
import type { DoctorAction } from "./types.ts";

export interface FixOutcome {
	actions: DoctorAction[];
	notice?: string;
}

/** Append `.doctor/` to the repo-root .gitignore (create it if absent). */
export async function fixGitignoreDoctorDir(
	run: RunContext,
	repoRoot: string,
): Promise<FixOutcome> {
	const gitignorePath = path.join(repoRoot, ".gitignore");
	const existed = await pathExists(gitignorePath);
	const resolved = await resolveSafe(repoRoot, gitignorePath);
	if (!resolved)
		throw new MutateError(`refusing to write outside repo root: ${gitignorePath}`, "out-of-scope");
	const action = existed
		? await appendDoctorLine(run, resolved, repoRoot)
		: await createGitignore(run, resolved);
	return {
		actions: [action],
		notice: existed ? ".gitignore appended with .doctor/" : ".gitignore created with .doctor/",
	};
}

async function resolveSafe(repoRoot: string, gitignorePath: string): Promise<string | null> {
	const stat = await fs.lstat(gitignorePath).catch(() => null);
	if (stat?.isSymbolicLink()) return null;
	return path.isAbsolute(gitignorePath) ? gitignorePath : path.join(repoRoot, gitignorePath);
}

function appendDoctorLine(run: RunContext, gitignorePath: string, repoRoot: string) {
	return mutate(run, {
		path: gitignorePath,
		scopeRoot: repoRoot,
		op: "append",
		content: ".doctor/\n",
	});
}

function createGitignore(run: RunContext, gitignorePath: string) {
	return mutate(run, {
		path: gitignorePath,
		scopeRoot: path.dirname(gitignorePath),
		op: "create",
		content: ".doctor/\n",
	});
}
