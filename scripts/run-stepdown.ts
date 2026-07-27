import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgRoot = path.dirname(require.resolve("stepdown-rule/package.json"));
const cli = path.join(pkgRoot, "src", "cli.ts");
const result = Bun.spawnSync(["bun", cli, ...process.argv.slice(2)], {
	stdout: "inherit",
	stderr: "inherit",
	stdin: "inherit",
});
process.exit(result.exitCode ?? 1);
