import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import packageJson from "../package.json";

function cwdIsGitRoot(): boolean {
	const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode !== 0) return false;
	const toplevel = result.stdout.toString().trim();
	return samePath(toplevel, process.cwd());
}

function samePath(left: string, right: string): boolean {
	const a = path.resolve(left);
	const b = path.resolve(right);
	if (process.platform === "win32") return a.toLowerCase() === b.toLowerCase();
	return a === b;
}

describe("package.json bin", () => {
	it("every bin target is a project file", () => {
		const bin = packageJson.bin;
		expect(bin).toBeDefined();
		const checkGit = cwdIsGitRoot();

		for (const [name, target] of Object.entries(bin)) {
			const rel = target.replace(/^\.\//, "");
			expect(existsSync(rel), `bin "${name}" target "${rel}" is missing`).toBe(true);
			if (!checkGit) continue;
			const result = Bun.spawnSync(["git", "ls-files", "--error-unmatch", rel], {
				stdout: "pipe",
				stderr: "pipe",
			});
			expect(result.exitCode, `bin "${name}" target "${rel}" is not in git`).toBe(0);
		}
	});
});
