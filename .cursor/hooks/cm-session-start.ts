// sessionStart: inject `cm context` as additional_context.
// Run with: bun .cursor/hooks/cm-session-start.ts

import { spawnSync } from "node:child_process";
import { type } from "arktype";
import {
	SessionStartInput,
	SessionStartOutput,
	emitSchema,
	parseJson,
	readStdinText,
} from "./schema.ts";

function sessionIdFrom(raw: string): string {
	if (raw.length === 0) return "";
	try {
		const input = SessionStartInput(parseJson(raw));
		if (input instanceof type.errors) return "";
		return input.session_id;
	} catch {
		return "";
	}
}

function taskName(): string {
	const task = process.env.CURSOR_CM_TASK;
	if (task === undefined || task.length === 0) return "session start";
	return task;
}

function contextFor(id: string): string {
	const args = ["context", taskName(), "--format", "markdown"];
	if (id.length > 0) args.push("--session", id);
	const result = spawnSync("cm", args, {
		encoding: "utf8",
		windowsHide: true,
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (result.error || typeof result.stdout !== "string") return "";
	return result.stdout;
}

try {
	emitSchema(SessionStartOutput, {
		additional_context: contextFor(sessionIdFrom(readStdinText())),
	});
} catch {
	emitSchema(SessionStartOutput, { additional_context: "" });
}
