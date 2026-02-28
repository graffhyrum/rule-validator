---
"@graff/rule-validator": patch
---

Improve type safety and testability

- Add FileReader interface for dependency injection in scanFile()
- Add bunFileReader default implementation
- Add explicit type annotations throughout compiler.ts
- Add is.nonNullExpression predicate for AST checking
- Add comprehensive test coverage for compiler and CLI
