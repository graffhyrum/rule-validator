import path from "node:path";
import { describe, expect, it } from "bun:test";
import { toPosixPath, toRelativePosix } from "./paths.ts";

describe("toPosixPath", () => {
	it("replaces backslashes with forward slashes", () => {
		const result = toPosixPath("src\\foo\\bar.ts");
		expect(result as string).toBe("src/foo/bar.ts");
	});

	it("leaves forward-slash paths unchanged", () => {
		const result = toPosixPath("src/foo/bar.ts");
		expect(result as string).toBe("src/foo/bar.ts");
	});
});

describe("toRelativePosix", () => {
	it("converts absolute path under cwd to relative posix", () => {
		const abs = path.join(process.cwd(), "src", "foo.ts");
		const result = toRelativePosix(abs);
		expect(result as string).toBe("src/foo.ts");
	});

	it("normalizes already-relative backslash paths", () => {
		const result = toRelativePosix("src\\foo.ts");
		expect(result as string).toBe("src/foo.ts");
	});

	it("leaves already-relative forward-slash paths unchanged", () => {
		const result = toRelativePosix("src/foo.ts");
		expect(result as string).toBe("src/foo.ts");
	});
});
