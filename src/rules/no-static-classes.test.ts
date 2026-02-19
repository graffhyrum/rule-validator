import { describe, expect, it } from "bun:test";
import { createAnalyzer, runRules } from "../index.js";
import { noStaticClassesRule } from "./no-static-classes.js";

describe("no-static-classes rule", () => {
	const createTestAnalyzer = async (code: string) => {
		const testFile = "/tmp/test.ts";
		await Bun.write(testFile, code);
		return createAnalyzer({
			pattern: testFile,
			tsconfigPath: "./tsconfig.json",
		});
	};

	it("should detect classes with only static members", async () => {
		const analyzer = await createTestAnalyzer(`
			class Utils {
				static add(a: number, b: number): number {
					return a + b;
				}
				static multiply(a: number, b: number): number {
					return a * b;
				}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag classes with instance members", async () => {
		const analyzer = await createTestAnalyzer(`
			class Counter {
				count = 0;
				static instances = 0;

				constructor() {
					Counter.instances++;
				}

				increment() {
					this.count++;
				}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "/tmp/test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
