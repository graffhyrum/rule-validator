// Cursor hook JSON from https://cursor.com/docs/hooks
// Input objects drop unknown keys. Cursor adds fields over time.
// Output objects reject unknown keys. A permission hook blocks on a bad response.

import { readFileSync } from "node:fs";
import { type } from "arktype";

const baseInput = {
	"conversation_id?": "string",
	"generation_id?": "string",
	"model?": "string",
	"model_id?": "string",
	"model_params?": type({ id: "string", value: "string" }).array(),
	"hook_event_name?": "string",
	"cursor_version?": "string",
	"workspace_roots?": "string[]",
	"user_email?": "string | null",
	"transcript_path?": "string | null",
} as const;

const hookOptions = {
	"timeout?": "number >= 0",
	"loop_limit?": type("number.integer >= 0").or("null"),
	"failClosed?": "boolean",
	"matcher?": "string",
} as const;

const CommandHook = type({
	command: "string",
	"type?": "'command'",
	...hookOptions,
}).onUndeclaredKey("reject");

const PromptHook = type({
	type: "'prompt'",
	prompt: "string",
	"model?": "string",
	...hookOptions,
}).onUndeclaredKey("reject");

const HookDefinition = PromptHook.or(CommandHook);

const hookList = HookDefinition.array();

export const HooksConfig = type({
	version: "number.integer >= 1",
	hooks: type({
		"sessionStart?": hookList,
		"sessionEnd?": hookList,
		"preToolUse?": hookList,
		"postToolUse?": hookList,
		"postToolUseFailure?": hookList,
		"subagentStart?": hookList,
		"subagentStop?": hookList,
		"beforeShellExecution?": hookList,
		"afterShellExecution?": hookList,
		"beforeMCPExecution?": hookList,
		"afterMCPExecution?": hookList,
		"beforeReadFile?": hookList,
		"afterFileEdit?": hookList,
		"beforeSubmitPrompt?": hookList,
		"preCompact?": hookList,
		"stop?": hookList,
		"afterAgentResponse?": hookList,
		"afterAgentThought?": hookList,
		"beforeTabFileRead?": hookList,
		"afterTabFileEdit?": hookList,
		"workspaceOpen?": hookList,
	}).onUndeclaredKey("reject"),
}).onUndeclaredKey("reject");

export const SessionStartInput = type({
	...baseInput,
	session_id: "string",
	// Docs list this boolean. It stays optional so a missing flag does not drop session_id.
	"is_background_agent?": "boolean",
	"composer_mode?": "'agent' | 'ask' | 'edit'",
}).onUndeclaredKey("delete");

export const SessionStartOutput = type({
	"env?": type({ "[string]": "string" }),
	"additional_context?": "string",
	"continue?": "boolean",
	"user_message?": "string",
}).onUndeclaredKey("reject");

export const ShellInput = type({
	...baseInput,
	command: "string",
	"cwd?": "string",
	"sandbox?": "boolean",
}).onUndeclaredKey("delete");

export const ShellOutput = type({
	permission: "'allow' | 'deny' | 'ask'",
	"continue?": "boolean",
	"user_message?": "string",
	"agent_message?": "string",
}).onUndeclaredKey("reject");

const FileEdit = type({
	old_string: "string",
	new_string: "string",
}).onUndeclaredKey("delete");

export const AfterFileEditInput = type({
	...baseInput,
	file_path: "string",
	edits: FileEdit.array(),
}).onUndeclaredKey("delete");

export const StopInput = type({
	...baseInput,
	status: "'completed' | 'aborted' | 'error'",
	loop_count: "number.integer >= 0",
}).onUndeclaredKey("delete");

export const StopOutput = type({
	"followup_message?": "string",
}).onUndeclaredKey("reject");

export function readStdinText(): string {
	try {
		return readFileSync(0, "utf8")
			.replace(/^\uFEFF/, "")
			.trim();
	} catch {
		return "";
	}
}

export function parseJson(raw: string): unknown {
	return JSON.parse(raw) as unknown;
}

export function emitSchema(schema: (data: unknown) => unknown, value: unknown): void {
	const result = schema(value);
	if (result instanceof type.errors) throw new Error(result.summary);
	process.stdout.write(`${JSON.stringify(result)}\n`);
}
