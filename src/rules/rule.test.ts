import { describe, expect, it, mock } from "bun:test";
import ts from "typescript";
import type { RuleContext } from "./rule.js";
import { createViolation } from "./rule.js";
describe("createViolation", () => {
    it("passes node and message through to addViolation", () => {
        const spy = mock(() => { });
        const sf = sourceFile();
        const node = valueName(sf);
        const ctx = makeContext(spy);
        createViolation(ctx, node, "variable is unused");
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ node, message: "variable is unused" });
    });
    it("preserves special characters in violation messages", () => {
        const messages = [
            "Expected `const` but found `let`",
            "",
            "<script> & special 'chars' \"here\"",
            `template with ${"interpolation"}`,
        ];
        for (const message of messages) {
            const spy = mock(() => { });
            const node = valueName(sourceFile());
            createViolation(makeContext(spy), node, message);
            expect(spy).toHaveBeenCalledWith({ node, message });
        }
    });
    it("produces one violation per call with distinct messages", () => {
        const calls: Array<{
            node: ts.Node;
            message: string;
        }> = [];
        const sf = sourceFile();
        const node = valueName(sf);
        const ctx = makeContext((v) => calls.push(v));
        createViolation(ctx, node, "first");
        createViolation(ctx, node, "second");
        expect(calls).toEqual([
            { node, message: "first" },
            { node, message: "second" },
        ]);
    });
});
function makeContext(addViolation: RuleContext["addViolation"]): RuleContext {
    const sf = sourceFile();
    return {
        rule: { name: "test-rule", description: "test", severity: "warning", visit: () => { } },
        analyzer: { sourceFiles: new Map([[sf.fileName, sf]]) },
        sourceFile: sf,
        addViolation,
    };
}
function sourceFile(): ts.SourceFile {
    return ts.createSourceFile("t.ts", "const value = 1;", ts.ScriptTarget.Latest, true);
}
function valueName(sf: ts.SourceFile): ts.Node {
    const stmt = sf.statements[0];
    if (stmt === undefined || !ts.isVariableStatement(stmt)) {
        throw new Error("expected a variable statement");
    }
    const decl = stmt.declarationList.declarations[0];
    if (decl === undefined) {
        throw new Error("expected a declaration");
    }
    return decl.name;
}
