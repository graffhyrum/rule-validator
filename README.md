# rule-validator

A CLI tool and library that scans TypeScript and JavaScript files for
code-quality violations. It runs regex and AST-based rules, reports
errors and warnings with file/line/column locations, and exits non-zero
on errors so it can gate CI.

**What it's for:** catching banned patterns in your codebase —
`waitForTimeout`, string concatenation, non-null
assertions, `as unknown as T`, and more — before they reach review.

**Who it's for:** developers enforcing code-quality rules in TS/JS
projects, especially Playwright, Bun, and Elysia codebases.

**Why choose it:** dual regex + AST detection for fewer false
positives, per-file and per-rule exclusions, config-file discovery
that walks up from the working directory, and JSON output for
automation.

## Quickstart

Prerequisites: [Bun](https://bun.sh) 1.4+.

```shell
git clone https://github.com/graffhyrum/rule-validator.git
cd rule-validator
bun install
bun run build
bun run validate
```

`bun run validate` scans `**/*.{ts,tsx,js,jsx}` in the current
directory and prints any violations. A clean run exits `0`.

Verify it works on your own code by pointing it at a glob:

```shell
bun run src/cli.ts "src/**/*.ts"
```

## Install

Use it in another project via a local link:

```shell
# in this repo
bun link

# in your project
bun link @graff/rule-validator
rule-validator
```

Or import the built library from `dist/`:

```typescript
import { scanFiles, scanFile, RULES } from "@graff/rule-validator";
```

## CLI usage

```shell
rule-validator [pattern] [--json]
```

- `pattern` — glob for files to scan (default
  `**/*.{ts,tsx,js,jsx}`).
- `--json` — print results as JSON instead of the human report.
- `-V, --version` / `-h, --help`.

Exit codes: `0` when there are no errors (warnings allowed), `1`
when errors are found or the scan crashes.

## Available rules

| Rule | Severity | What it catches |
| --- | --- | --- |
| `no-waitForTimeout` | error | Playwright `waitForTimeout()` — use auto-waiting |
| `no-non-null-assertion` | error | The `!` non-null assertion operator |
| `no-unknown-as-cast` | error | `as unknown as T` double casts |
| `no-expect-typeof-tobe` | error | `expect(typeof x).toBe(...)` runtime type checks |
| `no-toBeInstanceOf` | error | `toBeInstanceOf()` constructor checks |
| `no-static-classes` | error | Classes with only static members |
| `template-literals-only` | error | String concatenation instead of template literals |
| `prefer-bun-file-io` | warning | `node:fs` file I/O where `Bun.file`/`Bun.write` fits |
| `no-raw-response-in-elysia` | warning | `new Response()` in Elysia handlers |
| `no-raw-locator-in-spec` | error | Raw `page.locator()` in spec files |

## Configuration

Place a `rule-validator.config.json` at your project root. The tool
walks up from the current working directory to find it.

```json
{
  "exclude": ["legacy/**", "src/generated/**"],
  "rules": {
    "no-non-null-assertion": { "exclude": ["src/generated/**"] },
    "no-static-classes": { "exclude": ["src/infrastructure/**"] }
  }
}
```

- Global `exclude` appends to the built-in defaults; it cannot remove
  them.
- Per-rule `exclude` skips a rule for matching files only.
- A missing config changes nothing. A malformed config errors out
  with a non-zero exit.

See `src/config.ts` for the full schema.

## Programmatic API

```typescript
import { scanFiles, scanFile, RULES } from "@graff/rule-validator";

const result = await scanFiles("src/**/*.ts");
// { errorCount, warningCount, fileCount, violations? }

const violations = await scanFile("src/example.ts");
// [{ file, line, column, rule, match, ... }]
```

Full types live in `src/index.ts`.

## Development

Scripts run through Bun (`bun run …`):

```shell
bun run build          # build + type declarations
bun run test           # run tests
bun run test:coverage  # tests with coverage threshold
bun run typecheck      # TypeScript check
bun run check          # oxlint + oxfmt
bun run fix            # auto-fix lint/format
bun run vet            # full validation (build, typecheck, lint, test)
```

Rules live in `src/rules/` (one file per rule, with tests). Add a
rule there and register it in `src/rules/all-rules.ts` and
`src/rules.ts`. See `AGENTS.md` for coding rules and the test
isolation notes.

## License

[MIT](LICENSE).
