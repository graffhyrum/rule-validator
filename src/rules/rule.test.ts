// Tests for createViolation factory in rule.ts
// Verifies pass-through behavior without inspecting AST node internals
import { describe, it, expect, mock } from "bun:test";
import type * as ts from "typescript";
import { createViolation } from "./rule.js";
import type { RuleContext } from "./rule.js";

function makeContext(addViolation: RuleContext["addViolation"]): RuleContext {
	return {
		rule: { name: "test-rule", description: "test", severity: "warn", visit: () => {} },
		analyzer: {} as RuleContext["analyzer"],
		sourceFile: {} as ts.SourceFile,
		addViolation,
	};
}

describe("createViolation", () => {
	it("passes node and message through to addViolation", () => {
		const spy = mock(() => {});
		const node = {} as ts.Node;
		const ctx = makeContext(spy);

		createViolation(ctx, node, "variable is unused");

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith({ node, message: "variable is unused" });
	});

	it("forwards varied message strings unchanged", () => {
		const messages = [
			"Expected `const` but found `let`",
			"",
			"<script> & special 'chars' \"here\"",
			`template with ${"interpolation"}`,
		];

		for (const message of messages) {
			const spy = mock(() => {});
			const node = {} as ts.Node;
			createViolation(makeContext(spy), node, message);
			expect(spy).toHaveBeenCalledWith({ node, message });
		}
	});

	it("calls addViolation exactly once per createViolation invocation", () => {
		const spy = mock(() => {});
		const node = {} as ts.Node;
		const ctx = makeContext(spy);

		createViolation(ctx, node, "first");
		createViolation(ctx, node, "second");

		expect(spy).toHaveBeenCalledTimes(2);
	});
});
