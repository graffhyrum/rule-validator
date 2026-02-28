export function assertDefined<T>(x: unknown): asserts x is NonNullable<T> {
	if (x === undefined) throw new Error("Unexpected undefined value");

	if (x === null) throw new Error("Unexpected null value");
}
