// mutate(): the ONLY code path under `doctor --fix` allowed to write project
// files. Backs up verbatim first, writes atomically, records hashes + the
// action in `.doctor/runs/<run-id>/actions.jsonl`.
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathExists, resolveInside, backupVerbatim, writeAtomic, sha256 } from "./fs-utils.ts";
import { appendAction, type RunContext } from "./run-artifact.ts";
import type { DoctorAction } from "./types.ts";

export interface MutateRequest {
	/** Absolute path to the file to mutate. */
	path: string;
	/** `scopeRoot` the path must stay inside (symlink-safe). */
	scopeRoot: string;
	op: "create" | "append";
	/** Content appended (op=append) or written (op=create). */
	content: string;
}

export async function mutate(run: RunContext, req: MutateRequest): Promise<DoctorAction> {
	const target = await resolveInside(req.scopeRoot, req.path);
	if (!target) throw new MutateError("path escapes scope root", "out-of-scope");
	const existed = await pathExists(target);
	const before = existed ? sha256(await fs.readFile(target)) : null;
	const backupRel = backupPathFor(req.scopeRoot, target);
	if (existed) await backupVerbatim(target, run.backupsDir, backupRel);
	const next = await computeNextBytes(target, existed, req);
	await writeAtomic(target, next);
	const after = sha256(next);
	const action: DoctorAction = {
		path: target,
		op: req.op,
		beforeHash: before,
		afterHash: after,
		timestamp: new Date().toISOString(),
		existed,
	};
	await appendAction(run, { ...action, run_id: run.runId, backup: existed ? path.join("backups", backupRel) : null });
	return action;
}

export class MutateError extends Error {
	readonly reason: string;
	constructor(message: string, reason: string) {
		super(message);
		this.reason = reason;
	}
}

function backupPathFor(scopeRoot: string, target: string): string {
	const rel = path.relative(scopeRoot, target);
	const safe = rel.split(path.sep).join("/");
	return safe.length > 0 ? safe : "__root__";
}

async function computeNextBytes(target: string, existed: boolean, req: MutateRequest): Promise<Buffer> {
	const addition = Buffer.from(req.content);
	if (req.op === "create") {
		if (existed) throw new MutateError(`create target already exists: ${target}`, "already-exists");
		return addition;
	}
	const prior = existed ? await fs.readFile(target) : Buffer.alloc(0);
	if (prior.length > 0 && prior.subarray(prior.length - 1)[0] !== 0x0a) {
		return Buffer.concat([prior, Buffer.from("\n"), addition]);
	}
	return Buffer.concat([prior, addition]);
}
