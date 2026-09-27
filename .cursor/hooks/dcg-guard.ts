// beforeShellExecution: Cursor command → dcg → ShellOutput JSON.
// Fail-open on error. Always write schema-valid JSON.
// Run with: bun .cursor/hooks/dcg-guard.ts

import { spawnSync } from "node:child_process";
import { type } from "arktype";
import { ShellInput, ShellOutput, emitSchema, parseJson, readStdinText } from "./schema.ts";

type Permission = "allow" | "deny" | "ask";

function shellOutput(permission: Permission, message: string): void {
	emitSchema(ShellOutput, {
		permission,
		continue: permission !== "deny",
		...(message.length > 0 ? { user_message: message, agent_message: message } : {}),
	});
}

function childEnv(): NodeJS.ProcessEnv {
	return { ...process.env, CURSOR_IDE: "1" };
}

function dcgDecision(value: unknown): { permission: Permission; reason: string } {
	if (typeof value !== "object" || value === null || !("hookSpecificOutput" in value)) {
		return { permission: "allow", reason: "" };
	}
	const specific = value.hookSpecificOutput;
	if (typeof specific !== "object" || specific === null) {
		return { permission: "allow", reason: "" };
	}
	const decision = "permissionDecision" in specific ? specific.permissionDecision : undefined;
	const permission: Permission = decision === "deny" || decision === "ask" ? decision : "allow";
	const reasonValue =
		"permissionDecisionReason" in specific ? specific.permissionDecisionReason : undefined;
	const reason = typeof reasonValue === "string" ? reasonValue : "";
	return { permission, reason };
}

function main(): void {
	const raw = readStdinText();
	if (raw.length === 0) {
		shellOutput("allow", "");
		return;
	}

	let command = "";
	let cwd = "";
	try {
		const input = ShellInput(parseJson(raw));
		if (input instanceof type.errors) {
			shellOutput("allow", "");
			return;
		}
		command = input.command;
		cwd = input.cwd ?? "";
	} catch {
		shellOutput("allow", "");
		return;
	}
	if (command.length === 0) {
		shellOutput("allow", "");
		return;
	}

	const dcgBin = process.env.DCG_BIN ?? "dcg";
	if (dcgBin.length === 0) {
		shellOutput("allow", "");
		return;
	}

	const result = spawnSync(dcgBin, [], {
		input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
		encoding: "utf8",
		cwd: cwd.length > 0 ? cwd : undefined,
		env: childEnv(),
		windowsHide: true,
		stdio: ["pipe", "pipe", "ignore"],
	});
	if (result.error || typeof result.stdout !== "string") {
		shellOutput("allow", "");
		return;
	}
	const output = result.stdout.trim();
	if (output.length === 0) {
		shellOutput("allow", "");
		return;
	}

	try {
		const decision = dcgDecision(parseJson(output));
		const reason = decision.reason.length > 0 ? decision.reason : "Blocked by dcg";
		switch (decision.permission) {
			case "deny":
				shellOutput("deny", reason);
				return;
			case "ask":
				shellOutput("ask", reason);
				return;
			case "allow":
				shellOutput("allow", "");
				return;
			default: {
				const unreachable: never = decision.permission;
				shellOutput("allow", unreachable);
			}
		}
	} catch {
		shellOutput("allow", "");
	}
}

try {
	main();
} catch {
	shellOutput("allow", "");
}
