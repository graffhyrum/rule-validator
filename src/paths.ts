import path from "node:path";

export type FsPath = string & { readonly __brand: "FsPath" };
export type RelativePosixPath = string & { readonly __brand: "RelativePosixPath" };

export function asRelativePosix(p: string): RelativePosixPath {
	return p as RelativePosixPath;
}

export function toRelativePosix(file: string, cwd = process.cwd()): RelativePosixPath {
	const rel = path.isAbsolute(file) ? path.relative(cwd, file) : file;
	return toPosixPath(rel);
}

export function toPosixPath(p: string): RelativePosixPath {
	return p.replaceAll("\\", "/") as RelativePosixPath;
}
