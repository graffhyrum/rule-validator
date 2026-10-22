import { mkdirSync, writeFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";
import { extractComplexity } from "../node_modules/crap4ts/dist/complexity.js";

const SRC = "src";
const files: string[] = [];
for await (const entry of glob(`${SRC}/**/*.ts`, {
	exclude: (p: string) => p.includes(".test."),
})) {
	files.push(entry);
}

const coverage: Record<string, unknown> = {};
for (const file of files) {
	const source = await Bun.file(file).text();
	const functions = extractComplexity(source, file);
	const fnMap: Record<string, unknown> = {};
	functions.forEach((fn, index) => {
		const span = fn.identity.span;
		fnMap[String(index)] = {
			name: fn.identity.qualifiedName,
			loc: {
				start: { line: span.startLine, column: span.startColumn },
				end: { line: span.endLine - 1, column: span.endColumn },
			},
		};
	});
	coverage[file] = {
		path: file,
		statementMap: {},
		fnMap,
		s: {},
		branchMap: {},
		b: {},
	};
}

mkdirSync("coverage", { recursive: true });
writeFileSync("coverage/coverage-final.json", JSON.stringify(coverage, null, 2));
console.log(`Generated coverage for ${files.length} files.`);
