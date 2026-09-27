import { describe, expect, it } from "bun:test";
import { greetUser } from "../index.ts";

describe("example package", () => {
	it("greets through the entry point", () => {
		expect(greetUser("Ada")).toBe("Hello, Ada");
	});
});
