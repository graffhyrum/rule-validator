import { describe, expect, it } from "bun:test";
import { runRules } from "../../../rules/runner.ts";
import { createTestSourceFile } from "../../../rules/test-helpers.ts";
import { preferBunFileIoRule } from "../index.ts";

function violationsOf(code: string) {
	const analyzer = createTestSourceFile(code);
	const results = runRules({ analyzer, rules: [preferBunFileIoRule] });
	return results.flatMap((r) => r.violations);
}

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

	it("flags fs/promises entry points", () => {
		const vs = violationsOf(`
			import { readFile } from "node:fs/promises";
			import { readFileSync } from "fs/promises";
			readFile("p");
			readFileSync("p");
		`);
		expect(vs.length).toBe(2);
		expect(vs.every((v) => v.message.includes(".bytes()"))).toBe(true);
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

	it("flags a string-literal require binding and a default binding", () => {
		const vs = violationsOf(`
			const { "readFileSync": rf } = require("fs");
			const { default: fs } = require("node:fs");
			rf("p");
			fs.readFileSync("p");
		`);
		expect(vs.length).toBe(2);
	});

	it("flags an inline require call", () => {
		const vs = violationsOf(`
			require("node:fs").readFileSync("p");
			require("node:fs").promises.readFile("p");
		`);
		expect(vs.length).toBe(2);
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
			fs.writeFileSync("p", "d", { "flag": "a" as const });
			fs.writeFileSync("p", "d", "ascii");
			fs.copyFile("a", "b", 1);
			fs.copyFile("a", "b");
		`);
		expect(vs.length).toBe(2);
		const codes = vs.map((v) => v.code).join("\n");
		expect(codes).toContain("ascii");
		expect(codes).toContain('copyFile("a", "b")');
		expect(codes).not.toContain("flag");
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

	it("reads encoding from an options object", () => {
		const vs = violationsOf(`
			import * as fs from "node:fs";
			fs.readFileSync("p", { encoding: "utf8" });
			fs.readFile("p", { encoding: "utf-8" as const });
			fs.readFileSync("p", { "encoding": "hex" });
			fs.readFile("p", { encoding: "base64" });
		`);
		expect(vs.length).toBe(2);
		expect(vs[0]?.message).toContain(".text()");
		expect(vs[1]?.message).toContain(".text()");
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

	it("flags a read when the encoding is not a string literal", () => {
		const vs = violationsOf(`
			import * as fs from "node:fs";
			const encoding = "utf8";
			fs.readFileSync("p", encoding);
			fs.readFileSync("p", { encoding: encoding });
			fs.readFileSync("p", { "mode": 1, ["encoding"]: "hex" });
		`);
		expect(vs.length).toBe(3);
		expect(vs.every((v) => v.message.includes(".bytes()"))).toBe(true);
	});

	it("flags a write whose flag Bun.write can express", () => {
		const vs = violationsOf(`
			import * as fs from "node:fs";
			fs.writeFileSync("p", "d", { flag: "r" });
			fs.writeFileSync("p", "d", { flag: 1 });
			fs.writeFileSync("p", "d", { ["flag"]: "a" });
		`);
		expect(vs.length).toBe(3);
		expect(vs.map((v) => v.code).join("\n")).toContain('flag: "r"');
	});

	it("reads default imports, promise requires, and bindings that do not resolve", () => {
		const vs = violationsOf(`
			import fs from "node:fs";
			import * as fsp from "node:fs/promises";
			import broken from name;
			let unused;
			const { promises: p } = require("node:fs");
			const [readFileSync] = require("fs");
			const { readFileSync: {} } = require("node:fs");
			const fsFromVar = require(mod);
			fs.readFileSync("p");
			fsp.readFile("q");
			fsp.promises.readFile("q");
			p.readFile("r");
			fs.foo.readFile("s");
			notRequire().readFileSync("t");
			fs["readFileSync"]("u");
		`);
		expect(vs.map((v) => v.code)).toEqual([
			'fs.readFileSync("p")',
			'fsp.readFile("q")',
			'p.readFile("r")',
		]);
	});

	it("double runRules does not duplicate bindings", () => {
		const analyzer = createTestSourceFile(`
			import { readFileSync } from "node:fs";
			readFileSync("p");
		`);
		const first = runRules({ analyzer, rules: [preferBunFileIoRule] }).flatMap((r) => r.violations);
		const second = runRules({ analyzer, rules: [preferBunFileIoRule] }).flatMap(
			(r) => r.violations,
		);
		expect(first.length).toBe(1);
		expect(second.length).toBe(1);
		expect(first[0]?.location.line).toBe(second[0]?.location.line);
	});
});
