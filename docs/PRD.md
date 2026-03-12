# Rule Validator PRD

## Project Overview

**Project Name**: @graff/rule-validator
**Type**: CLI Tool / Library
**Core Functionality**: Scans TypeScript/JavaScript code for violations of development rules (e.g., no `any` types, no `waitForTimeout`, template literals only, etc.)
**Target Users**: Developers who want to enforce code quality rules in their projects

---

## Current State

### What Works

- Regex-based pattern matching for rule detection
- CLI that scans files and reports violations
- Configurable exclude patterns
- Exports library functions for programmatic use

### What's Broken

- **False positives**: Regex matches rule definitions themselves (e.g., the pattern `/\bwaitForTimeout\s*\(/g` matches the rule definition in the source code)
- **No AST context**: Can't distinguish actual code from strings, comments, or documentation
- **Limited precision**: Can't understand TypeScript types, scopes, or code structure
- **Fragile rules**: Each rule requires manual tuning to avoid false positives

### Current Architecture

```
src/
├── index.ts    # Library exports (Rule, Violation, scan functions)
└── cli.ts      # CLI entry point
```

**Detection Approach**: Text-based regex matching

- Simple, fast
- No dependencies beyond TypeScript
- Fundamentally limited in precision

---

## Problem Statement

The rule validator uses regex for pattern detection, which creates two classes of problems:

### Problem 1: Self-Referential Violations

The validator detects its own rule definitions as violations:

```typescript
// This line IS a violation (as a rule definition)
pattern: /\bwaitForTimeout\s*\(/g,
// But this is ALSO a match (because the pattern text contains "waitForTimeout")
const x = waitForTimeout(1000);
```

### Problem 2: String/Comment Matches

Regex can't distinguish:

- `const x: any = "any"` (string literal - should NOT match)
- `const x: any = value` (type annotation - SHOULD match)

### Problem 3: Limited Rule Types

Regex can only detect text patterns. It cannot:

- Detect unused imports
- Enforce type safety rules
- Analyze control flow
- Understand scoping

---

## Proposed Solution

### Approach: AST-Based Detection using TypeScript Compiler

Migrate from regex matching to AST analysis using the TypeScript compiler API (`typescript`).

### Why TypeScript Compiler?

1. **Already a dependency** - Already in `devDependencies`
2. **Precise** - Understands code structure, not just text
3. **Powerful** - Can implement complex rules
4. **Well-documented** - Extensive API available

### Architecture

```
src/
├── index.ts              # Library exports
├── cli.ts                # CLI entrypoint
├── ast/
│   ├── analyzer.ts      # AST traversal utilities
│   └── visitor.ts       # Visitor pattern for AST nodes
├── rules/
│   ├── registry.ts      # Rule registration
│   ├── no-any-types.ts  # Rule: no 'any' types
│   ├── no-wait-timeout.ts # Rule: no waitForTimeout
│   └── ...              # Additional rules
└── config/
    └── schema.ts        # Configuration schema
```

### Key Changes

| Aspect          | Current (Regex)       | Proposed (AST)             |
| --------------- | --------------------- | -------------------------- |
| Detection       | Text matching         | AST node analysis          |
| False positives | High                  | Minimal                    |
| Rule types      | Pattern matching only | Any AST-based check        |
| Performance     | Fast                  | Slightly slower (worth it) |
| Complexity      | Simple                | Moderate                   |

---

## Migration Plan

### Phase 1: Foundation

1. Set up TypeScript compiler integration
2. Create AST analyzer utilities
3. Build rule registry system

### Phase 2: Core Rules

4. Migrate existing rules to AST-based detection
5. Ensure parity with current behavior
6. Add tests for each rule

### Phase 3: Enhanced Rules

7. Add rules only possible with AST:
   - Unused imports
   - Type safety checks
   - Control flow analysis

### Phase 4: Polish

8. Configuration file support
9. Auto-fix capabilities (where possible)
10. Performance optimization

---

## Technical Details

### TypeScript Compiler API Usage

```typescript
import * as ts from "typescript";

// Create program from files
const program = ts.createProgram({
	rootNames: files,
	options: tsConfig,
});

// Get type checker
const checker = program.getTypeChecker();

// Visit each source file
for (const sourceFile of program.getSourceFiles()) {
	ts.forEachChild(sourceFile, visit);
}

function visit(node: ts.Node) {
	// Check for specific patterns
	if (ts.isTypeReferenceNode(node)) {
		// Analyze type reference
	}
	// Continue traversal
	ts.forEachChild(node, visit);
}
```

### Rule Interface

```typescript
interface Rule {
	name: string;
	description: string;
	severity: "error" | "warning";

	// AST-based check function
	check(context: RuleContext): Violation[];
}

interface RuleContext {
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
	options: RuleOptions;
}
```

---

## Backwards Compatibility

### CLI Interface (保持兼容)

```bash
# Same as before
rule-validator "src/**/*.ts"
rule-validator --fix "src/**/*.ts"
rule-validator --config .rulevalidatorrc "lib/**/*.ts"
```

### Library Interface (保持兼容)

```typescript
import { scanFiles, Violation } from "@graff/rule-validator";
// Same API, improved detection
```

---

## Open Questions

1. **Configuration format**: JSON? YAML? TypeScript?
2. **Auto-fix**: Which rules should have auto-fix?
3. **Rule extensibility**: Allow custom rules via plugin?
4. **Performance targets**: Max file size? Parallel processing?

---

## Acceptance Criteria

### Phase 1 Complete When:

- [ ] AST analyzer can parse TypeScript files
- [ ] At least one rule works with AST detection
- [ ] No false positives on rule definitions

### Phase 2 Complete When:

- [ ] All current rules migrated to AST
- [ ] CLI behavior matches current (or improves)
- [ ] Tests pass for all rules

### Phase 3 Complete When:

- [ ] New AST-only rules implemented
- [ ] Performance acceptable (<5s for typical project)

---

## Related Projects

- **stepdown-rule** (@stepdown/analyzer): Similar AST-based analysis for function ordering rules. Uses TypeScript compiler API - can use as reference implementation.

---

## Appendix: Current Rules

| Rule                   | Pattern                                  | Description                             |
| ---------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------------- |
| no-waitForTimeout      | `/\bwaitForTimeout\s*\(/g`               | Avoid static timeouts, use auto-waiting |
| no-any-types           | `/:\s*any\b/g`                           | No `any` types, use proper typing       |
| template-literals-only | `/"\s*\+\s*"                             | "\S+"\s*\+\s*\S+/g`                     | Use template literals, not string concat |
| no-static-classes      | `/export\s+class\s+\w+Impl/g`            | Avoid static-only classes               |
| no-unknown-as-cast     | `/ as unknown as\b/g`                    | Ban double cast through unknown         |
| no-expect-typeof-tobe  | `/expect\s*\(\s*typeof.+\)\.toBe\s*\(/g` | Ban typeof assertions                   |
| no-toBeInstanceOf      | `/\.toBeInstanceOf\s*\(/g`               | Ban constructor assertions              |
