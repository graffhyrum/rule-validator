import * as ts from "typescript";

/**
 * True when writeFile/writeFileSync options use a flag Bun.write cannot express:
 * append (`a…`) or exclusive create (`…x…`).
 */
export function hasNonBunWriteFlag(call: ts.CallExpression): boolean {
	for (const arg of call.arguments) {
		if (!ts.isObjectLiteralExpression(arg)) {
			continue;
		}
		const flagValue = readFlagStringLiteral(arg);
		if (flagValue === undefined) {
			continue;
		}
		if (/^a/.test(flagValue) || flagValue.includes("x")) {
			return true;
		}
	}
	return false;
}

function readFlagStringLiteral(options: ts.ObjectLiteralExpression): string | undefined {
	for (const prop of options.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue;
		}
		if (!isFlagPropertyName(prop.name)) {
			continue;
		}
		const literal = unwrapAsExpression(prop.initializer);
		if (ts.isStringLiteral(literal)) {
			return literal.text;
		}
	}
	return undefined;
}

function isFlagPropertyName(name: ts.PropertyName): boolean {
	if (ts.isIdentifier(name)) {
		return name.text === "flag";
	}
	if (ts.isStringLiteral(name)) {
		return name.text === "flag";
	}
	return false;
}

function unwrapAsExpression(node: ts.Expression): ts.Expression {
	if (ts.isAsExpression(node)) {
		return node.expression;
	}
	return node;
}
