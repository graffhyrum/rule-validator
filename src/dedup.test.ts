// Unit tests for deduplicateDisplayViolations and deduplicateJsonViolations.
// Verifies key collision handling and regex-over-AST preference.
import { describe, expect, it } from "bun:test";
import type { DisplayViolation, JsonViolation } from "./index.ts";
import { deduplicateDisplayViolations, deduplicateJsonViolations } from "./cli.ts";

function makeDisplay(overrides: Partial<DisplayViolation> = {}): DisplayViolation {
	return {
		file: "src/foo.ts",
		line: 1,
		column: 1,
		rule: { name: "no-any-types", message: "msg", severity: "error" },
		match: "any",
		...overrides,
	};
}

function makeJson(overrides: Partial<JsonViolation> = {}): JsonViolation {
	return {
		file: "src/foo.ts",
		line: 1,
		column: 1,
		rule: "no-any-types",
		message: "msg",
		severity: "error",
		match: "any",
		...overrides,
	};
}

describe("deduplicateDisplayViolations", () => {
	it("deduplicates same file+line+col+rule", () => {
		const a = makeDisplay();
		const b = makeDisplay({ match: "other" });
		const result = deduplicateDisplayViolations([a], [b]);
		expect(result).toHaveLength(1);
	});

	it("keeps both when key differs by line", () => {
		const a = makeDisplay({ line: 1 });
		const b = makeDisplay({ line: 2 });
		const result = deduplicateDisplayViolations([a], [b]);
		expect(result).toHaveLength(2);
	});

	it("keeps both when key differs by rule name", () => {
		const a = makeDisplay({ rule: { name: "rule-a", message: "m", severity: "error" } });
		const b = makeDisplay({ rule: { name: "rule-b", message: "m", severity: "error" } });
		const result = deduplicateDisplayViolations([a], [b]);
		expect(result).toHaveLength(2);
	});

	it("regex entry wins over AST on collision (sourceLine present on regex)", () => {
		const regex = makeDisplay({ sourceLine: "const x: any = 1" });
		const ast = makeDisplay();
		const result = deduplicateDisplayViolations([regex], [ast]);
		expect(result).toHaveLength(1);
		expect(result[0]?.sourceLine).toBe("const x: any = 1");
	});

	it("normalizes absolute file path to relative", () => {
		const abs = makeDisplay({ file: `${process.cwd()}/src/foo.ts` });
		const result = deduplicateDisplayViolations([abs], []);
		expect(result[0]?.file).toBe("src/foo.ts");
	});
});

describe("deduplicateJsonViolations", () => {
	it("deduplicates same file+line+col+rule", () => {
		const a = makeJson();
		const b = makeJson({ match: "other" });
		const result = deduplicateJsonViolations([a], [b]);
		expect(result).toHaveLength(1);
	});

	it("keeps both when key differs by column", () => {
		const a = makeJson({ column: 1 });
		const b = makeJson({ column: 5 });
		const result = deduplicateJsonViolations([a], [b]);
		expect(result).toHaveLength(2);
	});

	it("regex entry preferred over AST on collision", () => {
		const regex = makeJson({ match: "regex-match" });
		const ast = makeJson({ match: "ast-match" });
		const result = deduplicateJsonViolations([regex], [ast]);
		expect(result).toHaveLength(1);
		expect((result[0] as JsonViolation).match).toBe("regex-match");
	});

	it("AST entry kept when no regex collision", () => {
		const ast = makeJson({ line: 10 });
		const result = deduplicateJsonViolations([], [ast]);
		expect(result).toHaveLength(1);
	});
});
