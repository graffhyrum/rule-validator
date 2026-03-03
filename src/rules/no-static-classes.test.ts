import { describe, expect, it } from "bun:test";
import { noStaticClassesRule } from "./no-static-classes.js";
import { runRules } from "./runner.js";
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

	it("should not flag classes with a constructor", () => {
		const analyzer = createTestSourceFile(`
			class Singleton {
				static instance: Singleton;
				static create() { return new Singleton(); }
				constructor() {}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});

	it("should not flag classes with getters or setters", () => {
		const analyzer = createTestSourceFile(`
			class Config {
				static defaults = {};
				get value() { return 42; }
				set value(v: number) {}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});

	it("should not flag empty classes", () => {
		const analyzer = createTestSourceFile(`
			class Empty {}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
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

	it("should detect multiple static-only classes in one file", () => {
		const analyzer = createTestSourceFile(`
			class MathUtils {
				static add(a: number, b: number): number {
					return a + b;
				}
			}
			class StringUtils {
				static trim(s: string): string {
					return s.trim();
				}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(2);
	});

	it("should detect a static-only class defined inside a function", () => {
		const analyzer = createTestSourceFile(`
			function getUtils() {
				class InnerUtils {
					static helper(): string {
						return "help";
					}
				}
				return InnerUtils;
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(1);
		expect(testFileResults[0]?.violations.length).toBe(1);
	});

	it("should not flag a class with all static members plus one instance method", () => {
		const analyzer = createTestSourceFile(`
			class Hybrid {
				static count = 0;
				static create() { return new Hybrid(); }
				describe(): string {
					return "instance";
				}
			}
		`);
		const results = runRules({ analyzer, rules: [noStaticClassesRule] });
		const testFileResults = results.filter((r) => r.file === "test.ts");
		expect(testFileResults.length).toBe(0);
	});
});
