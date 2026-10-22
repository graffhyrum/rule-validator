import path from "node:path";
export type RelativePosixPath = string & {
	readonly __brand: "RelativePosixPath";
};
export function toRelativePosix(file: string, cwd = process.cwd()): RelativePosixPath {
	const rel = path.isAbsolute(file) ? path.relative(cwd, file) : file;
	return toPosixPath(rel);
}
export function toPosixPath(p: string): RelativePosixPath {
	const normalized = p.replaceAll("\\", "/");
	if (!isRelativePosixPath(normalized)) {
		throw new Error(`not a posix path: ${normalized}`);
	}
	return normalized;
}
export function isRelativePosixPath(value: string): value is RelativePosixPath {
	return !value.includes("\\");
}
export function asRelativePosix(p: string): RelativePosixPath {
	return p as RelativePosixPath;
}
