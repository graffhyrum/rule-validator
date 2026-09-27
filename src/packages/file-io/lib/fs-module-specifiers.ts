export const FS_MODULE_SPECIFIERS = ["fs", "node:fs", "fs/promises", "node:fs/promises"] as const;

export type FsModuleSpecifier = (typeof FS_MODULE_SPECIFIERS)[number];

export type FsModuleKind = "fs" | "fs-promises";

export function isFsModuleSpecifier(text: string): text is FsModuleSpecifier {
	return FS_MODULE_SPECIFIERS.some((spec) => spec === text);
}

export function fsModuleKind(spec: FsModuleSpecifier): FsModuleKind {
	return spec.endsWith("promises") ? "fs-promises" : "fs";
}
