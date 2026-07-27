/** Always excluded from glob/file discovery (node_modules, build output). */
export const ALWAYS_EXCLUDE = [
	"node_modules/**",
	"**/node_modules/**",
	"dist/**",
	"build/**",
] as const;

/** Test files and fixture dirs excluded by regex scan. */
export const TEST_AND_FIXTURE_EXCLUDE = [
	"**/__fixtures__/**",
	"**/*.test.ts",
	"**/*.test.tsx",
	"**/*.test.js",
	"**/*.test.jsx",
] as const;

/** Test/fixture patterns for AST scan (no .js/.jsx test globs). */
export const AST_TEST_AND_FIXTURE_EXCLUDE = [
	"**/__fixtures__/**",
	"**/*.test.ts",
	"**/*.test.tsx",
] as const;

/** Regex-line scan only (not AST defaults). */
export const REGEX_SCAN_ONLY_EXCLUDES = [
	"playwright-report/**",
	"netlify/**",
	"debug-cast.ts",
	"src/rules.ts",
	"src/rules/*.ts",
	"scripts/**",
] as const;

export const REGEX_SCAN_DEFAULT_EXCLUDES = [
	...ALWAYS_EXCLUDE,
	...REGEX_SCAN_ONLY_EXCLUDES,
	...TEST_AND_FIXTURE_EXCLUDE,
] as const;

export const AST_SCAN_DEFAULT_EXCLUDES = [...AST_TEST_AND_FIXTURE_EXCLUDE] as const;
