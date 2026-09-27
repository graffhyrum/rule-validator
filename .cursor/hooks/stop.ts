// stop: validate the stop payload, run `bun vet`, write StopOutput JSON.
// Vet logs go to stderr. Cursor reads stdout as the hook response.
// Run with: bun .cursor/hooks/stop.ts

import { spawnSync } from "node:child_process";
import { type } from "arktype";
import { StopInput, StopOutput, emitSchema, parseJson, readStdinText } from "./schema.ts";

function checkInput(raw: string): void {
	if (raw.length === 0) return;
	try {
		const input = StopInput(parseJson(raw));
		if (input instanceof type.errors) {
			process.stderr.write(`stop hook: invalid input: ${input.summary}\n`);
		}
	} catch {
		process.stderr.write("stop hook: stdin is not JSON\n");
	}
}

export function vetFollowup(status: number | null, output: string): string | undefined {
	if (status === 0) return undefined;
	const tail = output.trim().split(/\r?\n/).slice(-40).join("\n");
	const head = `bun vet failed (exit ${status ?? "signal"}).`;
	return tail.length > 0 ? `${head}\n${tail}` : head;
}

function runVet(): string | undefined {
	const result = spawnSync("bun", ["vet"], {
		encoding: "utf8",
		cwd: process.env.CURSOR_PROJECT_DIR,
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	if (output.length > 0) process.stderr.write(output);
	if (result.error) {
		process.stderr.write(`${result.error.message}\n`);
		return vetFollowup(result.status, `${output}${result.error.message}`);
	}
	return vetFollowup(result.status, output);
}

if (import.meta.main) {
	try {
		checkInput(readStdinText());
		const failure = runVet();
		emitSchema(StopOutput, failure ? { followup_message: failure } : {});
	} catch {
		emitSchema(StopOutput, {});
	}
}
