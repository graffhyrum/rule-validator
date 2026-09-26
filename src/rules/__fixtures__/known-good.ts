/* Clean code — no rule violations expected */
import { appendFileSync, mkdirSync, readdirSync } from "node:fs";

// Proper typing instead of any
function processData(data: string): string {
	return data.trim();
}

// assertDefined instead of non-null assertion
function assertDefined<T>(x: unknown): asserts x is NonNullable<T> {
	if (x === undefined) throw new Error("Unexpected undefined value");
	if (x === null) throw new Error("Unexpected null value");
}
const element: HTMLElement | null = document.getElementById("app");
assertDefined(element);

// Proper typing instead of double cast
const count: number = Number.parseInt("42", 10);

// Class with instance members (not static-only)
class Counter {
	count = 0;

	increment(): void {
		this.count++;
	}
}

// Template literal instead of concatenation
const name = "world";
const greeting = `Hello ${name}`;

// Proper Playwright waiting instead of waitForTimeout
async function waitExample(page: { waitForSelector: (s: string) => Promise<void> }) {
	await page.waitForSelector(".loaded");
}

// Behavior assertion instead of typeof check
function typeTests(x: unknown) {
	expect(x).toBe("hello");
}

// Behavior assertion instead of toBeInstanceOf
function instanceTests(result: { message: string }) {
	expect(result.message).toBe("error occurred");
}

// Numeric variable addition — must NOT trigger template-literals-only
const errorCount = 3;
const warningCount = 2;
const totalCount = errorCount + warningCount;

// prefer-bun-file-io: allowed node:fs + Bun APIs
void mkdirSync;
void readdirSync;
void appendFileSync;
async function bunIoExample(): Promise<void> {
	const text = await Bun.file("ok.txt").text();
	await Bun.write("out.txt", text);
}

export {
	processData,
	element,
	count,
	Counter,
	greeting,
	waitExample,
	typeTests,
	instanceTests,
	totalCount,
	bunIoExample,
};
