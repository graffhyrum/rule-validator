import * as ts from "typescript";
import type { AnalyzerContext } from "../typescript/compiler.js";

export function createTestSourceFile(code: string): AnalyzerContext {
	const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
	return { sourceFiles: new Map<string, ts.SourceFile>([["test.ts", sourceFile]]) };
}
