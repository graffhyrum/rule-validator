import { describe, expect, it } from "bun:test";
import * as ts from "typescript";
import { hasCopyFileFlagsArg } from "./copy-file-flags.js";
import { collectBindings } from "./fs-file-bindings.js";
import { fsModuleKind, isFsModuleSpecifier } from "./fs-module-specifiers.js";
import { preferBunFileIoRule } from "./prefer-bun-file-io.js";
import {
	formatMessage,
	formatReadMessage,
	isReplaceableFsSymbol,
} from "./replaceable-fs-symbols.js";
import { runRules } from "./runner.js";
import { createTestSourceFile } from "./test-helpers.js";
import { hasNonBunWriteFlag } from "./write-file-non-bun-flag.js";

function violationsOf(code: string) {
	const analyzer = createTestSourceFile(code);
	const results = runRules({ analyzer, rules: [preferBunFileIoRule] });
	return results.flatMap((r) => r.violations);
}

function parseCall(code: string): ts.CallExpression {
	const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.Latest, true);
	let found: ts.CallExpression | undefined;
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && found === undefined) {
			found = node;
		}
		ts.forEachChild(node, visit);
	}
	visit(sf);
	if (found === undefined) {
		throw new Error("no CallExpression");
	}
	return found;
}

describe("fs-module-specifiers", () => {
	it("recognizes watched modules", () => {
		expect(isFsModuleSpecifier("node:fs")).toBe(true);
		expect(isFsModuleSpecifier("fs/promises")).toBe(true);
		expect(isFsModuleSpecifier("path")).toBe(false);
		expect(fsModuleKind("node:fs")).toBe("fs");
		expect(fsModuleKind("node:fs/promises")).toBe("fs-promises");
	});
});

describe("replaceable-fs-symbols", () => {
	it("formatMessage includes suggestion and notes", () => {
		const msg = formatMessage("existsSync");
		expect(msg).toContain("Bun.file(path).exists()");
		expect(msg).toContain("directories");
	});

	it("formatReadMessage switches on utf8", () => {
		const utf8 = formatReadMessage("readFileSync", true);
		expect(utf8).toContain(".text()");
		expect(utf8).not.toContain("do not default to .text()");
		expect(formatReadMessage("readFileSync", false)).toContain(".bytes()");
		expect(formatReadMessage("readFileSync", false)).toContain("do not default to .text()");
	});

	it("isReplaceableFsSymbol", () => {
		expect(isReplaceableFsSymbol("readFileSync")).toBe(true);
		expect(isReplaceableFsSymbol("mkdirSync")).toBe(false);
	});
});

describe("hasNonBunWriteFlag", () => {
	it("skips append and exclusive flags", () => {
		expect(hasNonBunWriteFlag(parseCall(`writeFileSync(p, d, { flag: "a" })`))).toBe(true);
		expect(hasNonBunWriteFlag(parseCall(`writeFileSync(p, d, { flag: "a" as const })`))).toBe(
			true,
		);
		expect(hasNonBunWriteFlag(parseCall(`writeFileSync(p, d, { flag: "wx" })`))).toBe(true);
	});

	it("does not treat encoding strings as flags", () => {
		expect(hasNonBunWriteFlag(parseCall(`writeFileSync(p, d, "ascii")`))).toBe(false);
		expect(hasNonBunWriteFlag(parseCall(`writeFileSync(p, d)`))).toBe(false);
	});
});

describe("hasCopyFileFlagsArg", () => {
	it("detects third argument", () => {
		expect(hasCopyFileFlagsArg(parseCall(`copyFile(a, b)`))).toBe(false);
		expect(hasCopyFileFlagsArg(parseCall(`copyFile(a, b, 1)`))).toBe(true);
	});
});

describe("collectBindings", () => {
	it("records named imports and promises aliases", () => {
		const sf = ts.createSourceFile(
			"t.ts",
			`
			import { readFileSync, promises as fsp } from "node:fs";
			import { promises } from "node:fs";
			`,
			ts.ScriptTarget.Latest,
			true,
		);
		const b = collectBindings(sf);
		expect(b.namedLocals.get("readFileSync")).toBe("readFileSync");
		expect(b.promisesAliases.has("fsp")).toBe(true);
		expect(b.promisesAliases.has("promises")).toBe(true);
	});
});

describe("prefer-bun-file-io rule", () => {
	it("flags replaceable named-import call sites only", () => {
		const vs = violationsOf(`
			import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
			existsSync("p");
			mkdirSync("d");
			readdirSync("d");
			readFileSync("p");
			writeFileSync("p", "d");
		`);
		expect(vs.length).toBe(3);
		const messages = vs.map((v) => v.message).join("\n");
		expect(messages).toContain("Bun.file(path).exists()");
		expect(messages).toContain("Bun.write");
		expect(messages).toContain(".bytes()");
		expect(vs.every((v) => v.code.includes("("))).toBe(true);
	});

	it("ignores unused named imports", () => {
		const vs = violationsOf(`
			import { readFileSync, writeFileSync } from "node:fs";
		`);
		expect(vs.length).toBe(0);
	});

	it("attributes named import to call site not import line", () => {
		const vs = violationsOf(`
			import { readFileSync } from "node:fs";
			const x = 1;
			readFileSync("p", "utf8");
		`);
		expect(vs.length).toBe(1);
		expect(vs[0]?.location.line).toBe(4);
		expect(vs[0]?.code).toContain('readFileSync("p", "utf8")');
		expect(vs[0]?.message).toContain(".text()");
	});

	it("does not double-flag aliased named import calls", () => {
		const vs = violationsOf(`
			import { readFileSync as rf } from "node:fs";
			rf("p");
		`);
		expect(vs.length).toBe(1);
		expect(vs[0]?.code).toContain('rf("p")');
	});

	it("skips type-only imports; flags value call sites", () => {
		const vs = violationsOf(`
			import type { readFileSync } from "node:fs";
			import { type readFile, writeFile } from "node:fs";
			import type * as fs from "node:fs";
			writeFile("p", "d");
		`);
		expect(vs.length).toBe(1);
		expect(vs[0]?.code).toContain("writeFile");
	});

	it("detects fs.promises and promises aliases", () => {
		const vs = violationsOf(`
			import * as fs from "node:fs";
			import { promises as fsp } from "node:fs";
			import { promises } from "node:fs";
			fs.promises.readFile("p");
			fsp.readFile("p");
			promises.readFile("p");
		`);
		expect(vs.length).toBe(3);
	});

	it("detects require after call via two-pass bindings", () => {
		const vs = violationsOf(`
			fs.readFileSync("p");
			const fs = require("node:fs");
		`);
		expect(vs.length).toBe(1);
	});

	it("flags destructured require at call site", () => {
		const vs = violationsOf(`
			const { readFileSync } = require("node:fs");
			readFileSync("p");
		`);
		expect(vs.length).toBe(1);
		expect(vs[0]?.code).toContain('readFileSync("p")');
		expect(vs[0]?.location.line).toBe(3);
	});

	it("supports import equals", () => {
		const vs = violationsOf(`
			import fs = require("node:fs");
			fs.readFileSync("p");
		`);
		expect(vs.length).toBe(1);
	});

	it("skips append/wx write and flagged copy; flags ascii encoding write", () => {
		const vs = violationsOf(`
			import * as fs from "node:fs";
			fs.writeFileSync("p", "d", { flag: "a" });
			fs.writeFileSync("p", "d", { flag: "wx" });
			fs.writeFileSync("p", "d", "ascii");
			fs.copyFile("a", "b", 1);
			fs.copyFile("a", "b");
		`);
		expect(vs.length).toBe(2);
		const codes = vs.map((v) => v.code).join("\n");
		expect(codes).toContain("ascii");
		expect(codes).toContain('copyFile("a", "b")');
	});

	it("read encoding messages and base64 skip", () => {
		const utf8 = violationsOf(`
			import * as fs from "node:fs";
			fs.readFileSync("p", "utf8");
		`);
		expect(utf8.length).toBe(1);
		expect(utf8[0]?.message).toContain(".text()");

		const bare = violationsOf(`
			import * as fs from "node:fs";
			fs.readFileSync("p");
		`);
		expect(bare.length).toBe(1);
		expect(bare[0]?.message).toContain(".bytes()");

		const b64 = violationsOf(`
			import * as fs from "node:fs";
			fs.readFileSync("p", "base64");
		`);
		expect(b64.length).toBe(0);
	});

	it("allows mkdir/readdir/appendFile and Bun APIs", () => {
		const vs = violationsOf(`
			import { mkdirSync, readdirSync, appendFileSync } from "node:fs";
			mkdirSync("d");
			readdirSync("d");
			appendFileSync("f", "x");
			await Bun.file("f").text();
			await Bun.write("f", "x");
		`);
		expect(vs.length).toBe(0);
	});

	it("does not flag other-pkg namespace", () => {
		const vs = violationsOf(`
			import * as fs from "other-pkg";
			fs.readFileSync("p");
		`);
		expect(vs.length).toBe(0);
	});

	it("double runRules does not duplicate bindings", () => {
		const analyzer = createTestSourceFile(`
			import { readFileSync } from "node:fs";
			readFileSync("p");
		`);
		const first = runRules({ analyzer, rules: [preferBunFileIoRule] }).flatMap(
			(r) => r.violations,
		);
		const second = runRules({ analyzer, rules: [preferBunFileIoRule] }).flatMap(
			(r) => r.violations,
		);
		expect(first.length).toBe(1);
		expect(second.length).toBe(1);
		expect(first[0]?.location.line).toBe(second[0]?.location.line);
	});
});
