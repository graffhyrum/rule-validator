/* eslint-disable -- fixture file with intentional violations */

// no-any-types: uses `any` keyword
function processData(data: any): any {
	return data;
}

// no-non-null-assertion: uses `!` operator
const element = document.getElementById("app")!;
const nested = element!.firstChild;

// no-unknown-as-cast: double cast through unknown
const forced = "hello" as unknown as number;

// no-static-classes: class with only static members
class MathUtils {
	static add(a: number, b: number): number {
		return a + b;
	}
	static multiply(a: number, b: number): number {
		return a * b;
	}
}

// template-literals-only: string concatenation with +
const greeting = "Hello " + name;

// no-wait-for-timeout: static timeout
async function waitExample(page: { waitForTimeout: (ms: number) => Promise<void> }) {
	await page.waitForTimeout(1000);
}

// no-expect-typeof-tobe: typeof in expect().toBe()
function typeTests(x: unknown) {
	expect(typeof x).toBe("string");
}

// no-toBeInstanceOf: toBeInstanceOf assertion
function instanceTests(x: unknown) {
	expect(x).toBeInstanceOf(Error);
}

export { processData, element, nested, forced, MathUtils, greeting, waitExample, typeTests, instanceTests };
