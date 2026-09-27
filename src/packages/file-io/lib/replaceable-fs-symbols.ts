export const REPLACEABLE_FS_SYMBOLS = {
	readFileSync: {
		suggestion:
			"await Bun.file(path).bytes() (or .arrayBuffer(); use .text()/.json() only for UTF-8/JSON text)",
		notes: [
			"sync→async: enclosing function must become async",
			"default Node return is Buffer — do not default to .text()",
		],
	},
	readFile: {
		suggestion: "await Bun.file(path).bytes() (or .arrayBuffer(); .text()/.json() when UTF-8/JSON)",
		notes: [
			"callback or Promise API → prefer await Bun.file(...)",
			"default Node return is Buffer — do not default to .text()",
		],
	},
	writeFileSync: {
		suggestion: "await Bun.write(path, data)",
		notes: ["sync→async: enclosing function must become async"],
	},
	writeFile: {
		suggestion: "await Bun.write(path, data)",
		notes: ["callback or Promise API → prefer await Bun.write(...)"],
	},
	existsSync: {
		suggestion:
			"if path is a file: await Bun.file(path).exists(); if path is a directory: keep existsSync / use node:fs",
		notes: ["Bun.file().exists() is false for directories — never apply blindly"],
	},
	unlink: {
		suggestion: "if path is a file: await Bun.file(path).delete(); if directory: use node:fs rm",
		notes: ["files only"],
	},
	unlinkSync: {
		suggestion: "if path is a file: await Bun.file(path).delete(); if directory: use node:fs rm",
		notes: ["files only", "sync→async"],
	},
	copyFile: {
		suggestion: "await Bun.write(dest, Bun.file(src), { createPath: false })",
		notes: [
			"plain copy only — if COPYFILE_EXCL / FICLONE (or any flags arg) is used, keep node:fs (rule skips those calls)",
			"fs.copyFile fails when dest parent is missing; omit createPath:false only if you want Bun to create parents",
		],
	},
	copyFileSync: {
		suggestion: "await Bun.write(dest, Bun.file(src), { createPath: false })",
		notes: ["plain copy only; sync→async; flagged copyFile* calls with a flags arg are skipped"],
	},
} as const;

export type ReplaceableFsSymbol = keyof typeof REPLACEABLE_FS_SYMBOLS;

export function formatReadMessage(
	symbol: "readFile" | "readFileSync",
	encodingAwareText: boolean,
): string {
	if (!encodingAwareText) {
		return formatMessage(symbol);
	}
	const syncNote =
		symbol === "readFileSync"
			? "sync→async: enclosing function must become async"
			: "callback or Promise API → prefer await Bun.file(...)";
	return `await Bun.file(path).text(). ${syncNote}`;
}

export function isReplaceableFsSymbol(name: string): name is ReplaceableFsSymbol {
	return Object.hasOwn(REPLACEABLE_FS_SYMBOLS, name);
}

export function formatMessage(symbol: ReplaceableFsSymbol): string {
	const { suggestion, notes } = REPLACEABLE_FS_SYMBOLS[symbol];
	return `${suggestion}. ${notes.join(" ")}`;
}
