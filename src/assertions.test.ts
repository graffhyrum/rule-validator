import { describe, expect, it } from "bun:test";
import { assertDefined } from "./assertions";

describe("assertDefined", () => {
	it("throws on undefined", () => {
		expect(() => assertDefined(undefined)).toThrow("Unexpected undefined value");
	});

	it("throws on null", () => {
		expect(() => assertDefined(null)).toThrow("Unexpected null value");
	});

	it("does not throw for a string value", () => {
		expect(() => assertDefined("hello")).not.toThrow();
	});

	it("does not throw for falsy 0", () => {
		expect(() => assertDefined(0)).not.toThrow();
	});

	it("does not throw for falsy false", () => {
		expect(() => assertDefined(false)).not.toThrow();
	});
});
