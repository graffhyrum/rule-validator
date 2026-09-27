import { greet } from "./lib/impl.ts";

/** Entry point. Callers and tests use this function. `greet` stays hidden. */
export function greetUser(name: string): string {
	return greet(name);
}
