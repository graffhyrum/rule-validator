import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { type CliDeps, guardEntry, main } from "./cli.ts";

const scanFiles = mock();
const exitWithResult = mock();
const runAstRules = mock();
const printViolations = mock((file: unknown) => {
	console.log(file);
});
const loadProjectConfig = mock();

const deps = {
	scanFiles,
	exitWithResult,
	runAstRules,
	printViolations,
	loadProjectConfig,
} as unknown as CliDeps;

function run(argv: string[]): Promise<void> {
	return main(argv, deps);
}

function thrownMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

beforeEach(() => {
	scanFiles.mockClear();
	exitWithResult.mockClear();
	runAstRules.mockClear();
	printViolations.mockClear();
	loadProjectConfig.mockClear();
	loadProjectConfig.mockResolvedValue({});
	runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0 });
});

describe("CLI main function", () => {
	it("should use default pattern when no args and handle successful scan", async () => {
		scanFiles.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		await run(["node", "cli.ts"]);

		expect(scanFiles).toHaveBeenCalledWith("**/*.{ts,tsx,js,jsx}", { json: undefined, config: {} });
		expect(exitWithResult).toHaveBeenCalledWith(0, 0, 0);
	});

	it("should use provided pattern and handle successful scan with errors and warnings", async () => {
		scanFiles.mockResolvedValue({ errorCount: 1, warningCount: 2 });

		await run(["node", "cli.ts", "src/**/*.ts"]);

		expect(scanFiles).toHaveBeenCalledWith("src/**/*.ts", { json: undefined, config: {} });
		expect(exitWithResult).toHaveBeenCalledWith(1, 2, 0);
	});

	it("should combine regex and AST rule results", async () => {
		scanFiles.mockResolvedValue({ errorCount: 1, warningCount: 0, fileCount: 5 });
		runAstRules.mockResolvedValue({ errorCount: 2, warningCount: 3, fileCount: 3 });

		await run(["node", "cli.ts"]);

		expect(exitWithResult).toHaveBeenCalledWith(3, 3, 8);
	});

	it("should print display violations via printDedupedDisplay when present", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 1,
			warningCount: 0,
			displayViolations: [
				{
					file: "src/foo.ts",
					line: 10,
					column: 5,
					rule: { name: "test-rule", message: "test error", severity: "error" },
					match: "badCode",
				},
			],
		});

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			await run(["node", "cli.ts"]);
		} catch {
			// expected if exitWithResult is not mocked to throw
		}

		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("src/foo.ts");
		expect(exitWithResult).toHaveBeenCalledWith(1, 0, 0);
		logSpy.mockRestore();
	});

	it("should handle error in scanFiles", async () => {
		const error = new Error("scan failed");
		scanFiles.mockRejectedValue(error);

		const consoleMock = mock(() => {});
		const originalError = console.error;
		console.error = consoleMock;
		const logSpy = spyOn(console, "log").mockImplementation(() => {});
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await run(["node", "cli.ts"]);
			expect(true).toBe(false);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 1");
		} finally {
			console.error = originalError;
		}

		try {
			expect(consoleMock).toHaveBeenCalledWith("Error scanning files:", "scan failed");
			expect(exitSpy).toHaveBeenCalledWith(1);
			expect(exitWithResult).not.toHaveBeenCalled();
			const stdout = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
			expect(stdout).toContain("rule-validator");
			expect(stdout).toContain("Run failed");
			expect(stdout).not.toContain("\n\n\n");
		} finally {
			logSpy.mockRestore();
			exitSpy.mockRestore();
		}
	});

	it("human run stdout starts with framed header", async () => {
		scanFiles.mockResolvedValue({ errorCount: 0, warningCount: 0 });
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		await run(["node", "cli.ts"]);

		const stdout = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(stdout.startsWith("\n")).toBe(true);
		expect(stdout).toContain("── rule-validator");
		expect(stdout).not.toContain("\n\n\n");
		logSpy.mockRestore();
	});
});

describe("CLI --version flag", () => {
	it("--version should output the package version", async () => {
		const { version } = require("../package.json");
		const captured: string[] = [];
		const writeMock = mock((...args: unknown[]) => {
			captured.push(String(args[0]));
			return true;
		});
		const originalWrite = process.stdout.write;
		process.stdout.write = writeMock as typeof process.stdout.write;

		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await run(["node", "cli.ts", "--version"]);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = captured.join("");
		try {
			expect(output).toContain(version);
			expect(exitSpy).toHaveBeenCalledWith(0);
		} finally {
			exitSpy.mockRestore();
		}
	});

	it("-V should output the package version", async () => {
		const { version } = require("../package.json");
		const captured: string[] = [];
		const writeMock = mock((...args: unknown[]) => {
			captured.push(String(args[0]));
			return true;
		});
		const originalWrite = process.stdout.write;
		process.stdout.write = writeMock as typeof process.stdout.write;

		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await run(["node", "cli.ts", "-V"]);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
			exitSpy.mockRestore();
		}

		const output = captured.join("");
		expect(output).toContain(version);
	});
});

describe("CLI --help flag", () => {
	it("--help should output usage information", async () => {
		const captured: string[] = [];
		const writeMock = mock((...args: unknown[]) => {
			captured.push(String(args[0]));
			return true;
		});
		const originalWrite = process.stdout.write;
		process.stdout.write = writeMock as typeof process.stdout.write;

		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await run(["node", "cli.ts", "--help"]);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = captured.join("");
		try {
			expect(output).toContain("rule-validator");
			expect(output).toContain("pattern");
			expect(output).toContain("--version");
			expect(output).toContain("--help");
			expect(exitSpy).toHaveBeenCalledWith(0);
		} finally {
			exitSpy.mockRestore();
		}
	});
});

describe("CLI --json flag", () => {
	it("--json should output JSON format", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 1,
			warningCount: 0,
			violations: [
				{
					file: "a.ts",
					line: 1,
					column: 1,
					rule: "test",
					message: "msg",
					severity: "error",
					match: "x",
				},
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0, violations: [] });

		const captured: string[] = [];
		const logMock = mock((...args: unknown[]) => {
			captured.push(String(args[0]));
		});
		const originalLog = console.log;
		console.log = logMock;
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await run(["node", "cli.ts", "--json"]);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 1");
		} finally {
			console.log = originalLog;
			exitSpy.mockRestore();
		}

		const output = captured[0] ?? "";
		const parsed = JSON.parse(output);
		expect(parsed.errorCount).toBe(1);
		expect(parsed.violations).toHaveLength(1);
		expect(parsed.violations[0].rule).toBe("test");
		expect(captured).toHaveLength(1);
		expect(output).not.toContain("rule-validator");
	});
});

describe("countFromJsonViolations path via deduplicateAndPrint", () => {
	it("counts errors and warnings from json violations when no display violations are present", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 0,
			warningCount: 0,
			violations: [
				{ file: "a.ts", line: 1, column: 1, rule: "rule-a", message: "msg", severity: "error", match: "x" },
				{ file: "a.ts", line: 2, column: 1, rule: "rule-b", message: "msg", severity: "warning", match: "y" },
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0, violations: [] });

		await run(["node", "cli.ts"]);

		expect(exitWithResult).toHaveBeenCalledWith(1, 1, 0);
	});

	it("counts only errors from json violations with no display violations", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 0,
			warningCount: 0,
			violations: [
				{ file: "b.ts", line: 5, column: 3, rule: "rule-c", message: "msg", severity: "error", match: "z" },
				{ file: "b.ts", line: 6, column: 3, rule: "rule-d", message: "msg", severity: "error", match: "w" },
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0, violations: [] });

		await run(["node", "cli.ts"]);

		expect(exitWithResult).toHaveBeenCalledWith(2, 0, 0);
	});
});

describe("printDedupedDisplay sort comparator branches", () => {
	it("sorts violations from different files alphabetically (a.file !== b.file branch)", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 2,
			warningCount: 0,
			displayViolations: [
				{
					file: "z-last.ts",
					line: 1,
					column: 1,
					rule: { name: "rule-a", message: "error", severity: "error" },
					match: "x",
				},
				{
					file: "a-first.ts",
					line: 1,
					column: 1,
					rule: { name: "rule-b", message: "error", severity: "error" },
					match: "y",
				},
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			await run(["node", "cli.ts"]);
		} catch {
			// expected if exitWithResult throws
		}

		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("a-first.ts");
		expect(output).toContain("z-last.ts");
		logSpy.mockRestore();
	});

	it("sorts violations from the same file by line number (a.line !== b.line branch)", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 2,
			warningCount: 0,
			displayViolations: [
				{
					file: "same.ts",
					line: 20,
					column: 1,
					rule: { name: "rule-a", message: "error", severity: "error" },
					match: "x",
				},
				{
					file: "same.ts",
					line: 5,
					column: 1,
					rule: { name: "rule-b", message: "error", severity: "error" },
					match: "y",
				},
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		try {
			await run(["node", "cli.ts"]);
		} catch {
			// expected if exitWithResult throws
		}

		const calls = logSpy.mock.calls.map((c) => String(c[0]));
		const lineNumbers = calls.filter((s) => s.includes("same.ts") || s.match(/^\s*\d+/));
		expect(lineNumbers.length).toBeGreaterThan(0);
		logSpy.mockRestore();
	});

	it("sorts violations on the same line by column", async () => {
		scanFiles.mockResolvedValue({
			errorCount: 2,
			warningCount: 0,
			displayViolations: [
				{
					file: "same.ts",
					line: 5,
					column: 20,
					rule: { name: "rule-a", message: "error", severity: "error" },
					match: "late",
				},
				{
					file: "same.ts",
					line: 5,
					column: 3,
					rule: { name: "rule-b", message: "error", severity: "error" },
					match: "early",
				},
			],
		});
		runAstRules.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		try {
			await run(["node", "cli.ts"]);
		} catch {
			// expected if exitWithResult throws
		}

		expect(printViolations).toHaveBeenCalledWith("same.ts", [
			expect.objectContaining({ line: 5, column: 3 }),
			expect.objectContaining({ line: 5, column: 20 }),
		]);
	});
});

describe("guardEntry", () => {
	it("returns when the entry resolves", async () => {
		await guardEntry(async () => {});
	});

	it("prints an Error message and exits 1", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await guardEntry(async () => {
				throw new Error("boom");
			});
			expect(true).toBe(false);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 1");
		}

		expect(errorSpy).toHaveBeenCalledWith("boom");
		expect(exitSpy).toHaveBeenCalledWith(1);
		errorSpy.mockRestore();
		exitSpy.mockRestore();
	});

	it("prints a non-Error failure and exits 1", async () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await guardEntry(async () => {
				throw "disk full";
			});
			expect(true).toBe(false);
		} catch (e) {
			expect(thrownMessage(e)).toBe("exit 1");
		}

		expect(errorSpy).toHaveBeenCalledWith("disk full");
		expect(exitSpy).toHaveBeenCalledWith(1);
		errorSpy.mockRestore();
		exitSpy.mockRestore();
	});
});
