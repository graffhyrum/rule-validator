import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const scanFilesMock = mock();
const printSummaryReportMock = mock();
const exitWithResultMock = mock();

beforeEach(() => {
	scanFilesMock.mockClear();
	printSummaryReportMock.mockClear();
	exitWithResultMock.mockClear();
});

async function main() {
	const args: string[] = process.argv.slice(2);
	const pattern: string = args[0] || "**/*.{ts,tsx,js,jsx}";

	try {
		const { errorCount, warningCount } = await scanFilesMock(pattern);
		printSummaryReportMock(errorCount, warningCount);
		exitWithResultMock(errorCount, warningCount);
	} catch (error) {
		console.error("❌ Error scanning files:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

describe("CLI main function", () => {
	it("should use default pattern when no args and handle successful scan", async () => {
		process.argv = ["bun", "cli.ts"];
		scanFilesMock.mockResolvedValue({ errorCount: 0, warningCount: 0 });

		const consoleSpy = spyOn(console, "error");
		const exitSpy = spyOn(process, "exit");

		await main();

		expect(scanFilesMock).toHaveBeenCalledWith("**/*.{ts,tsx,js,jsx}");
		expect(printSummaryReportMock).toHaveBeenCalledWith(0, 0);
		expect(exitWithResultMock).toHaveBeenCalledWith(0, 0);
		expect(consoleSpy).not.toHaveBeenCalled();
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("should use provided pattern and handle successful scan with errors and warnings", async () => {
		process.argv = ["bun", "cli.ts", "src/**/*.ts"];
		scanFilesMock.mockResolvedValue({ errorCount: 1, warningCount: 2 });

		const consoleSpy = spyOn(console, "error");
		const exitSpy = spyOn(process, "exit");

		await main();

		expect(scanFilesMock).toHaveBeenCalledWith("src/**/*.ts");
		expect(printSummaryReportMock).toHaveBeenCalledWith(1, 2);
		expect(exitWithResultMock).toHaveBeenCalledWith(1, 2);
		expect(consoleSpy).not.toHaveBeenCalled();
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("should handle error in scanFiles", async () => {
		process.argv = ["bun", "cli.ts"];
		const error = new Error("scan failed");
		scanFilesMock.mockRejectedValue(error);

		const consoleMock = mock(() => {});
		const originalError = console.error;
		console.error = consoleMock;
		const exitSpy = spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`exit ${code}`);
		});

		try {
			await main();
			expect(true).toBe(false);
		} catch (e) {
			expect((e as Error).message).toBe("exit 1");
		} finally {
			console.error = originalError;
		}

		expect(consoleMock).toHaveBeenCalledWith("❌ Error scanning files:", "scan failed");
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(printSummaryReportMock).not.toHaveBeenCalled();
		expect(exitWithResultMock).not.toHaveBeenCalled();
	});
});
