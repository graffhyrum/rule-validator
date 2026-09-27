# rule-validator

A CLI tool and library for validating code against custom linting rules. Scans TypeScript and JavaScript files for violations and reports errors/warnings.

## Installation

```shell
bun install
bun run build
```

Or install as a dependency:

```shell
bun add @graff/rule-validator
```

Or link locally:

```shell # from this directory
bun link
```

```shell # in target project
bun link @graff/rule-validator
rule-validator
```

## CLI Usage

### Basic Usage

Scan all TypeScript/JavaScript files in the current directory:

```shell
bun run validate
```

Or run directly:

```shell
bun run src/cli.ts
```

### Custom File Pattern

Specify a glob pattern to scan specific files:

```shell
bun run validate "src/**/*.ts"
```

### Exit Codes

- `0` - No errors (clean or warnings only)
- `1` - Errors found

## Available Rules

| Rule                     | Severity | Description                                                         |
| ------------------------ | -------- | ------------------------------------------------------------------- |
| `no-waitForTimeout`      | error    | Disallow Playwright's `waitForTimeout()` - use auto-waiting instead |
| `no-any-types`           | error    | Disallow `any` type annotations                                     |
| `template-literals-only` | error    | Require template literals instead of string concatenation           |
| `no-static-classes`      | error    | Disallow static-only class patterns (use module functions)          |
| `no-unknown-as-cast`     | error    | Disallow double casting through `unknown` (`as unknown as T`)       |
| `no-expect-typeof-tobe`  | error    | Disallow `expect(typeof x).toBe(type)` - use TypeScript instead     |
| `no-toBeInstanceOf`      | error    | Disallow `toBeInstanceOf()` - use behavior-focused assertions       |

## Configuration

Place a `rule-validator.config.json` file at your project root (or any ancestor directory — the tool walks up from the current working directory to find it).

### Global Exclusions

Patterns here are merged with the built-in defaults. Files matching any pattern are skipped entirely.

```json
{
	"exclude": ["legacy/**", "src/generated/**"]
}
```

### Per-Rule Exclusions

Files matching a rule's `exclude` patterns are skipped only for that rule; other rules still apply.

```json
{
	"rules": {
		"no-non-null-assertion": {
			"exclude": ["src/generated/**", "src/adapters/legacy/**"]
		},
		"no-static-classes": {
			"exclude": ["src/infrastructure/**"]
		}
	}
}
```

### Combined Example

```json
{
	"exclude": ["legacy/**"],
	"rules": {
		"no-non-null-assertion": {
			"exclude": ["src/generated/**"]
		}
	}
}
```

**Notes:**

- Global `exclude` appends to the built-in defaults; it cannot remove them.
- If no config file is found, behavior is identical to current defaults (no regression).
- A malformed or schema-invalid config produces a clear error and a non-zero exit.

## Programmatic API

```typescript
import { scanFiles, scanFile, RULES } from "@graff/rule-validator";

// Scan multiple files
const result = await scanFiles("src/**/*.ts");
console.log(result);
// { totalViolations: 5, errorCount: 3, warningCount: 2 }

// Scan a single file
const violations = await scanFile("src/example.ts");
console.log(violations);
// [{ file: "src/example.ts", line: 10, column: 5, rule: {...}, match: ": any" }]

// Access available rules
console.log(RULES);
```

### API Reference

#### `scanFiles(pattern: string, excludePatterns?: string[], excludeName?: string): Promise<ScanResult>`

Scans files matching the glob pattern for rule violations.

#### `scanFile(filePath: string): Promise<Violation[]>`

Scans a single file and returns all violations found.

#### `RULES: Rule[]`

Array of all registered rules with their patterns and messages.

## Development

Scripts use Bun (`bun run …`). Invoke them via Bun, not raw npm/cmd.

### Scripts

```shell
bun run build        # Build the project
bun run test         # Run tests
bun run test:coverage # Run tests with coverage
bun run test:mutate  # Run mutation tests (Stryker)
bun run typecheck    # Type check
bun run check        # Biome lint check
bun run fix          # Biome lint fix
bun run vet          # Full validation (build, typecheck, lint, test)
```

### Adding Custom Rules

Rules are defined in `src/rules.ts` with a pattern, message, and severity:

```typescript
export const RULES: Rule[] = [
	{
		name: "my-custom-rule",
		pattern: /myPattern/g,
		message: "Description of the violation",
		severity: "error", // or "warning"
	},
];
```

For AST-based rules, see `src/rules/no-any-types.ts` as an example.

### Mutation testing

Stryker changes production code and re-runs the test suite. A mutant survives when the tests still pass.

```shell
bun run test:mutate
```

Check that the suite loads under Stryker without scoring mutants:

```shell
bunx stryker run --dryRunOnly
```

Configuration is `stryker.conf.mjs`. Stryker loads only `json`, `js`, `mjs`, and `cjs` config files. The test runner is `@hughescr/stryker-bun-runner`. Stryker itself runs on Node 22 or newer. The test processes run on Bun.

`bun fastvet` does not run mutation tests. A full run is slow. Incremental results are stored in `reports/stryker-incremental.json`. The HTML report is `reports/mutation/mutation.html`. Those paths, `.stryker-tmp`, and `stryker.log` are gitignored. The score does not fail the process.

`src/config.ts` is excluded from mutation. Instrumentation changes the `ENOTDIR` path, and the dry run then returns `{}` instead of throwing.

On Windows, `patches/@hughescr+stryker-bun-runner@1.4.0.patch` rewrites the coverage preload path so backslashes are not string escapes. It also starts each `bun test` child with `windowsHide` and without `detached`, because Windows ignores the hide flag on a detached process and then opens a console. `bun install` applies the patch.

## License

[MIT](LICENSE).
