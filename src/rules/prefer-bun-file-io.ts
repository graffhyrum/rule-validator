import * as ts from "typescript";
import { hasCopyFileFlagsArg } from "./copy-file-flags.js";
import { ensureBindings, resolveFsCall, type ResolvedFsCall } from "./fs-file-bindings.js";
import { formatMessage, formatReadMessage } from "./replaceable-fs-symbols.js";
import { createViolation, type ASTRule, type RuleContext } from "./rule.js";
import { is } from "../typescript/index.js";
import { hasNonBunWriteFlag } from "./write-file-non-bun-flag.js";

export const preferBunFileIoRule: ASTRule = {
	name: "prefer-bun-file-io",
	description: "Prefer Bun.file / Bun.write over replaceable node:fs file I/O APIs",
	severity: "warning",
	visit(context: RuleContext, node: ts.Node): void {
		if (!is.callExpression(node)) {
			return;
		}
		reportCall(context, node);
	},
};

function reportCall(context: RuleContext, call: ts.CallExpression): void {
	const bindings = ensureBindings(context.sourceFile);
	const resolved = resolveFsCall(call, bindings);
	if (resolved === undefined) {
		return;
	}
	if (shouldSkipWriteCall(resolved, call)) {
		return;
	}
	if (shouldSkipCopyCall(resolved, call)) {
		return;
	}
	if (shouldSkipEncodedRead(resolved, call)) {
		return;
	}
	createViolation(context, resolved.reportNode, messageForCall(resolved, call));
}

function shouldSkipWriteCall(resolved: ResolvedFsCall, call: ts.CallExpression): boolean {
	if (resolved.symbol !== "writeFile" && resolved.symbol !== "writeFileSync") {
		return false;
	}
	return hasNonBunWriteFlag(call);
}

function shouldSkipCopyCall(resolved: ResolvedFsCall, call: ts.CallExpression): boolean {
	if (resolved.symbol !== "copyFile" && resolved.symbol !== "copyFileSync") {
		return false;
	}
	return hasCopyFileFlagsArg(call);
}

function shouldSkipEncodedRead(resolved: ResolvedFsCall, call: ts.CallExpression): boolean {
	if (resolved.symbol !== "readFile" && resolved.symbol !== "readFileSync") {
		return false;
	}
	const encoding = readEncodingLiteral(call);
	return encoding === "base64" || encoding === "hex";
}

function messageForCall(resolved: ResolvedFsCall, call: ts.CallExpression): string {
	if (resolved.symbol === "readFile" || resolved.symbol === "readFileSync") {
		const encoding = readEncodingLiteral(call);
		const utf8 = encoding === "utf8" || encoding === "utf-8";
		return formatReadMessage(resolved.symbol, utf8);
	}
	return formatMessage(resolved.symbol);
}

function readEncodingLiteral(call: ts.CallExpression): string | undefined {
	const second = call.arguments[1];
	if (second === undefined) {
		return undefined;
	}
	if (ts.isStringLiteral(second)) {
		return second.text.toLowerCase();
	}
	if (!ts.isObjectLiteralExpression(second)) {
		return undefined;
	}
	for (const prop of second.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue;
		}
		if (!isEncodingPropertyName(prop.name)) {
			continue;
		}
		const value = ts.isAsExpression(prop.initializer)
			? prop.initializer.expression
			: prop.initializer;
		if (ts.isStringLiteral(value)) {
			return value.text.toLowerCase();
		}
	}
	return undefined;
}

function isEncodingPropertyName(name: ts.PropertyName): boolean {
	if (ts.isIdentifier(name)) {
		return name.text === "encoding";
	}
	if (ts.isStringLiteral(name)) {
		return name.text === "encoding";
	}
	return false;
}
