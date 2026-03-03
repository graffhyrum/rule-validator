import * as ts from "typescript";
import type { AnalyzerContext } from "../typescript/compiler.js";

export function createTestSourceFile(code: string): AnalyzerContext {
	const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
	const sourceFiles = new Map<string, ts.SourceFile>([["test.ts", sourceFile]]);
	return {
		program: {} as ts.Program,
		checker: {} as ts.TypeChecker,
		sourceFiles,
	};
}
