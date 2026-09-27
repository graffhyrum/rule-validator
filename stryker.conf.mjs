/** @type {import("@hughescr/stryker-bun-runner").StrykerBunOptions} */
export default {
	testRunner: "bun",
	appendPlugins: ["@hughescr/stryker-bun-runner"],
	coverageAnalysis: "perTest",
	incremental: true,
	ignorePatterns: ["dist", "coverage", ".specstory", ".test-tmp", ".cursor"],
	mutate: [
		"src/**/*.ts",
		"!src/**/*.test.ts",
		"!src/**/__fixtures__/**",
		"!src/**/test-helpers.ts",
		// Instrumentation changes the ENOTDIR path. The dry run then returns {} instead of throwing.
		"!src/config.ts",
	],
	bun: {
		timeout: 120_000,
		inspectorTimeout: 10_000,
	},
};
