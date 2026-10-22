import { defineConfig } from "crap4ts";

export default defineConfig({
	threshold: 16,
	coverageMetric: "line",
	exclude: ["**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
	// format: "table",
	// src: ["src"],
	// breakdown: "off",
	// sort: "crap",
	// top: 10,
	// summary: false,
});
