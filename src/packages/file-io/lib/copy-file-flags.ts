import type * as ts from "typescript";

/** True when copyFile/copyFileSync has any arg beyond (src, dest). */
export function hasCopyFileFlagsArg(call: ts.CallExpression): boolean {
	return call.arguments.length > 2;
}
