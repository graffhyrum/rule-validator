import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import {
	AfterFileEditInput,
	HooksConfig,
	SessionStartInput,
	SessionStartOutput,
	ShellInput,
	ShellOutput,
	StopInput,
	StopOutput,
	emitSchema,
	parseJson,
	readStdinText,
} from "../.cursor/hooks/schema.ts";

const base = {
	conversation_id: "conv",
	generation_id: "gen",
	model: "grok-4.7",
	hook_event_name: "beforeShellExecution",
	cursor_version: "3.19.13",
	workspace_roots: ["C:/repo"],
	user_email: null,
	transcript_path: null,
};

describe("Cursor hooks schema", () => {
	test("project hooks.json matches the config schema", () => {
		const raw = parseJson(readFileSync(".cursor/hooks.json", "utf8"));
		const result = HooksConfig(raw);
		expect(result instanceof type.errors).toBe(false);
	});

	test("unknown hook name is rejected", () => {
		const result = HooksConfig({ version: 1, hooks: { notAHook: [{ command: "bun x" }] } });
		expect(result instanceof type.errors).toBe(true);
	});

	test("sessionStart docs example", () => {
		const input = SessionStartInput({
			...base,
			hook_event_name: "sessionStart",
			session_id: "sess",
			is_background_agent: false,
			composer_mode: "agent",
		});
		expect(input instanceof type.errors).toBe(false);
		const output = SessionStartOutput({ additional_context: "rules" });
		expect(output instanceof type.errors).toBe(false);
	});

	test("beforeShellExecution drops unknown keys and rejects camelCase output", () => {
		const input = ShellInput({
			...base,
			command: "git status",
			cwd: "",
			sandbox: false,
			session_id: "s",
		});
		expect(input instanceof type.errors).toBe(false);
		if (input instanceof type.errors) return;
		expect(input.command).toBe("git status");
		expect("session_id" in input).toBe(false);

		const output = ShellOutput({
			permission: "deny",
			continue: false,
			user_message: "no",
			agent_message: "no",
		});
		expect(output instanceof type.errors).toBe(false);
		const camel = ShellOutput({ permission: "allow", userMessage: "no" });
		expect(camel instanceof type.errors).toBe(true);
	});

	test("afterFileEdit docs example", () => {
		const input = AfterFileEditInput({
			...base,
			hook_event_name: "afterFileEdit",
			file_path: "C:/repo/src/index.ts",
			edits: [{ old_string: "a", new_string: "b" }],
		});
		expect(input instanceof type.errors).toBe(false);
	});

	test("readStdinText returns text and emitSchema writes JSON", () => {
		expect(typeof readStdinText()).toBe("string");
		const writes: string[] = [];
		const original = process.stdout.write;
		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;
		try {
			emitSchema(type("string"), "ok");
			expect(writes.join("")).toBe("\"ok\"\n");
			expect(() => emitSchema(type("number"), "no")).toThrow();
		} finally {
			process.stdout.write = original;
		}
	});

	test("stop docs example writes no follow-up", () => {
		const input = StopInput({
			...base,
			hook_event_name: "stop",
			status: "completed",
			loop_count: 0,
		});
		expect(input instanceof type.errors).toBe(false);
		const output = StopOutput({});
		expect(output instanceof type.errors).toBe(false);
	});
});
