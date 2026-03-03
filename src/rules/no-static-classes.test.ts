import { describe, expect, it } from "bun:test";
import { runRules } from "./runner.js";
import { noStaticClassesRule } from "./no-static-classes.js";
import { createTestSourceFile } from "./test-helpers.js";

describe("no-static-classes rule", () => {
	it("should detect classes with only static members", () => {
		const analyzer = createTestSourceFile(`
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
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag classes with instance members", () => {
		const analyzer = createTestSourceFile(`
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
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
