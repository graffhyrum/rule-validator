import type { Rule } from "./index.js";

export const RULES: Rule[] = [
	{
		name: "no-waitForTimeout",
		pattern: /\b\.waitForTimeout\s*\(/g,
		message:
			"Unexpected static timeout. Use Playwright auto-waiting or web-first assertions instead.",
		severity: "error",
	},
	{
		name: "template-literals-only",
		pattern: /"\s*\+\s*"|"\S+"\s*\+\s*\S+(?!\s*\))|\S+\s*\+\s*"(?!\s*\))/g,
		message: "Use template literals instead of string concatenation.",
		severity: "error",
	},
	{
		name: "no-static-classes",
		pattern: /export\s+class\s+\w+Impl/g,
		message: "Static-only class detected. Convert to module-level functions.",
		severity: "error",
	},
	{
		name: "no-unknown-as-cast",
		pattern: / as unknown as\b/g,
		message:
			"Double cast via `as unknown as T` bypasses type safety. Use assertion functions or proper typing.",
		severity: "error",
	},
	{
		name: "no-expect-typeof-tobe",
		pattern: /expect\s*\(\s*typeof\s+.+\)\s*\.toBe\s*\(/g,
		message:
			"Unexpected `expect(typeof x).toBe()`. Use TypeScript types or schema assertions instead of runtime type checks.",
		severity: "error",
	},
	{
		name: "no-toBeInstanceOf",
		pattern: /\.toBeInstanceOf\s*\(/g,
		message:
			"Unexpected `toBeInstanceOf()`. Use behavior-focused assertions instead of checking constructor types.",
		severity: "error",
	},
	{
		name: "no-raw-response-in-elysia",
		// Excludes legitimate Bun stream reads: new Response(proc.stdout).text()
		pattern: /new Response\s*\((?!proc\.)/g,
		message:
			"Unexpected `new Response()`. Use set.status, set.headers, and redirect() in Elysia handlers.",
		severity: "warning",
	},
];
