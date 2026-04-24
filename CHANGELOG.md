# @graff/rule-validator

## 1.0.0

### Minor Changes

- 275cf12: Add Elysia framework rule and scripts exclusion
  - Added `no-raw-response-in-elysia` rule to detect improper Response constructor usage in Elysia applications
  - Added `scripts/**` to default file exclusions to prevent scanning build/utility scripts

- f52442a: Add no-non-null-assertion rule to ban the ! operator

  New ESLint-style rule that disallows non-null assertions. Provides helpful
  message suggesting use of assertDefined() utility instead.

  Includes:
  - Rule implementation in src/rules/no-non-null-assertion.ts
  - Test coverage in src/rules/no-non-null-assertion.test.ts
  - assertDefined utility in src/assertions.ts for user reference

- 9325267: Add project tooling configuration: Biome linter/formatter, changesets for versioning, and git attributes for beads merge strategy.
- 4305b9d: Refactor rule validator into modular architecture with separate rule modules and TypeScript compiler integration. Each rule is now in its own file with tests.
- aceb7e7: Add production dependencies and build configuration: arktype for validation, commander for CLI, glob for file scanning. Add biome and changesets as dev dependencies.

### Patch Changes

- e01d5b9: Add type declaration generation config and build script for producing .d.ts files.
- 49c5e62: Remove duplicate printSummaryReport call in CLI — exitWithResult already prints the summary
- 3a7a1e7: Fix createVisitor double-visiting child nodes, fix glob exclude patterns not working with absolute paths, remove dead context field from VisitorOptions interface
- f426336: Improve type safety and testability
  - Add FileReader interface for dependency injection in scanFile()
  - Add bunFileReader default implementation
  - Add explicit type annotations throughout compiler.ts
  - Add is.nonNullExpression predicate for AST checking
  - Add comprehensive test coverage for compiler and CLI

- 570fffc: Update dependencies: @biomejs/biome 2.4.4, @types/node 25.3.2
- b761f71: Initialize beads issue tracking with rule-validator prefix.
- e8934ad: Add project documentation: AGENTS.md with agent instructions, README.md, and PRD documentation.
