import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const scanFilesMock = mock();
const exitWithResultMock = mock();
const runAstRulesMock = mock();

mock.module("./index.ts", () => ({
	scanFiles: scanFilesMock,
	exitWithResult: exitWithResultMock,
}));

mock.module("./ast-scan.ts", () => ({
	runAstRules: runAstRulesMock,
}));

const { main } = await import("./cli.ts");

afterAll(() => mock.restore());

beforeEach(() => {
	scanFilesMock.mockClear();
	exitWithResultMock.mockClear();
	runAstRulesMock.mockClear();
	runAstRulesMock.mockResolvedValue({ errorCount: 0, warningCount: 0 });
});

describe("CLI main function", () => {
	it("should use default pattern when no args and handle successful scan", async () => {
		scanFilesMock.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		await main(["node", "cli.ts"]);

		expect(scanFilesMock).toHaveBeenCalledWith("**/*.{ts,tsx,js,jsx}", { json: undefined });
		expect(exitWithResultMock).toHaveBeenCalledWith(0, 0, 0);
	});

	it("should use provided pattern and handle successful scan with errors and warnings", async () => {
		scanFilesMock.mockResolvedValue({ errorCount: 1, warningCount: 2 });

		await main(["node", "cli.ts", "src/**/*.ts"]);

		expect(scanFilesMock).toHaveBeenCalledWith("src/**/*.ts", { json: undefined });
		expect(exitWithResultMock).toHaveBeenCalledWith(1, 2, 0);
	});

	it("should combine regex and AST rule results", async () => {
		scanFilesMock.mockResolvedValue({ errorCount: 1, warningCount: 0, fileCount: 5 });
		runAstRulesMock.mockResolvedValue({ errorCount: 2, warningCount: 3, fileCount: 3 });

		await main(["node", "cli.ts"]);

		expect(exitWithResultMock).toHaveBeenCalledWith(3, 3, 8);
	});

	it("should print display violations via printDedupedDisplay when present", async () => {
		scanFilesMock.mockResolvedValue({
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
			await main(["node", "cli.ts"]);
		} catch {
			// expected if exitWithResult is not mocked to throw
		}

		const output = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
		expect(output).toContain("src/foo.ts");
		expect(exitWithResultMock).toHaveBeenCalledWith(1, 0, 0);
		logSpy.mockRestore();
	});

	it("should handle error in scanFiles", async () => {
		const error = new Error("scan failed");
		scanFilesMock.mockRejectedValue(error);

		const consoleMock = mock(() => {});
		const originalError = console.error;
		console.error = consoleMock;
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await main(["node", "cli.ts"]);
			expect(true).toBe(false);
		} catch (e) {
			expect((e as Error).message).toBe("exit 1");
		} finally {
			console.error = originalError;
		}

		expect(consoleMock).toHaveBeenCalledWith("Error scanning files:", "scan failed");
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(exitWithResultMock).not.toHaveBeenCalled();
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
			await main(["node", "cli.ts", "--version"]);
		} catch (e) {
			expect((e as Error).message).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = captured.join("");
		expect(output).toContain(version);
		expect(exitSpy).toHaveBeenCalledWith(0);
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

		spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await main(["node", "cli.ts", "-V"]);
		} catch (e) {
			expect((e as Error).message).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
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
			await main(["node", "cli.ts", "--help"]);
		} catch (e) {
			expect((e as Error).message).toBe("exit 0");
		} finally {
			process.stdout.write = originalWrite;
		}

		const output = captured.join("");
		expect(output).toContain("rule-validator");
		expect(output).toContain("pattern");
		expect(output).toContain("--version");
		expect(output).toContain("--help");
		expect(exitSpy).toHaveBeenCalledWith(0);
	});
});

describe("CLI --json flag", () => {
	it("--json should output JSON format", async () => {
		scanFilesMock.mockResolvedValue({
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
		runAstRulesMock.mockResolvedValue({ errorCount: 0, warningCount: 0, violations: [] });

		const captured: string[] = [];
		const logMock = mock((...args: unknown[]) => {
			captured.push(String(args[0]));
		});
		const originalLog = console.log;
		console.log = logMock;
		spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await main(["node", "cli.ts", "--json"]);
		} catch (e) {
			expect((e as Error).message).toBe("exit 1");
		} finally {
			console.log = originalLog;
		}

		const output = captured[0] ?? "";
		const parsed = JSON.parse(output);
		expect(parsed.errorCount).toBe(1);
		expect(parsed.violations).toHaveLength(1);
		expect(parsed.violations[0].rule).toBe("test");
	});
});
