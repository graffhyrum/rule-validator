// `doctor capabilities --json` and `doctor robot-docs` — the self-describing
// agent contract. Keep stable: additive changes only within contract 1.0.
import { DOCTOR_CONTRACT_VERSION, DOCTOR_VERSION } from "./types.ts";
import packageJson from "../../package.json";

export function capabilitiesJson(): object {
	return {
		schema_version: DOCTOR_CONTRACT_VERSION,
		tool: "rule-validator",
		tool_version: packageJson.version,
		doctor_version: DOCTOR_VERSION,
		contract_version: DOCTOR_CONTRACT_VERSION,
		offline: true,
		fs_writes: [
			"<cwd>/.doctor/** (run artifacts)",
			"<repo>/.gitignore (only via `doctor --fix`, single line `.doctor/`)",
		],
		fixers: [
			{
				failure_mode: "fm-io-gitignore-missing-doctor-dir",
				op: "append `.doctor/` to <repo>/.gitignore (creates the file if absent)",
				verify:
					"re-runs the detector after the fix; byte-identical backups in .doctor/runs/<run-id>/backups/",
				undo: "rule-validator doctor undo <run-id>",
			},
		],
		detectors: [
			["fm-io-doctor-dir-unwritable", "preflight; artifacts cannot persist; --fix refuses"],
			["fm-runtime-not-bun", "runtime is not Bun"],
			["fm-rules-engine-regex-missing-g-flag", "regex rule missing g flag"],
			[
				"fm-rules-engine-registry-integrity",
				"registry invariants (names, severities, messages, visitors)",
			],
			["fm-rules-engine-ast-smoke-fails", "AST engine silently dead or wrong"],
			["fm-rules-engine-parse-diagnostics", "TS parseDiagnostics canary"],
			["fm-configs-config-file-malformed-json", "config exists but JSON.parse fails"],
			["fm-configs-config-schema-reject", "config rejected by arktype schema"],
			[
				"fm-configs-config-unknown-rule-name",
				"config rules keys match no known rule (inert exclusion)",
			],
			["fm-configs-config-exclude-glob-no-match", "top-level exclude glob matches zero files"],
			["fm-io-gitignore-missing-doctor-dir", "repo does not ignore .doctor/"],
		].map(([id, description]) => ({ id, description })),
		exit_codes: {
			"0": "healthy (no findings, or fix applied cleanly)",
			"1": "findings present (no --fix), or findings remain after --fix failed to help",
			"2": "fix attempted, only partially applied",
			"3": "fix failed and rolled back",
			"4": "refused (unsafe precondition, out-of-scope write, artifacts unwritable, or doctor cannot fix)",
			"5": "concurrency lost — another doctor holds .doctor/lock",
			"6": "online required (unused this pass; probes are offline)",
			"64": "usage error (bad flags)",
			"66": "no input (e.g. undo for a missing run-id)",
			"73": "cannot create output (.doctor/ unwritable and artifacts requested)",
			"74": "I/O error",
		},
		env: ["NO_COLOR", "RULE_VALIDATOR_DOCTOR_ONLINE (reserved; no probes this pass)"],
		report_schema: DOCTOR_CONTRACT_VERSION,
		undo: "rule-validator doctor undo <run-id|latest>",
	};
}

export const ROBOT_DOCS = `rule-validator doctor — agent handbook
==========================================
SELF-DESCRIBE FIRST
  rule-validator doctor capabilities --json   # contract, detectors, exit codes
  rule-validator doctor robot-docs            # this text

READ-ONLY HEALTH CHECK (never mutates; exits 0 healthy / 1 findings)
  rule-validator doctor                       # human summary
  rule-validator doctor --json                # full report JSON
  rule-validator doctor --quick               # skip the AST in-memory smoke (fastest)
  rule-validator doctor --robot-triage        # one call: {summary, findings, recommended_command}
  rule-validator doctor --explain <finding-id>   # expand one finding with evidence
  rule-validator doctor --only=<id,id>        # run specific detectors
  rule-validator doctor health                # one-line liveness for CI (exit 0/1)

REPAIR (always preceded by verbatim backups; fully reversible)
  rule-validator doctor --dry-run --fix       # print the plan, touch nothing
  rule-validator doctor --fix                 # apply fixable findings
  rule-validator doctor --fix --only fm-io-gitignore-missing-doctor-dir
  rule-validator doctor undo <run-id>         # restore byte-identical (or quarantine created files)
  rule-validator doctor undo latest
  rule-validator doctor ls                    # list past runs

EXIT CODES
  0 healthy · 1 findings · 2 partial fix · 3 rolled back · 4 refused (unsafe) ·
  5 concurrency lost · 6 online required · 64 usage · 66 no input · 73 cannot create · 74 I/O

GROUND RULES
  - Detect is pure: no writes except .doctor/run artifacts (report.json, actions.jsonl, latest symlink).
  - Every fix goes through mutate(): backup → atomic write → hash-witnessed actions.jsonl.
  - doctor never edits src/, package.json, tests, CI, or rule-validator.config.json.
  - Network: none. doctor runs fully offline.
  - .doctor/ is machine-local; the repo ignores it (fixer adds the line for you).
`;
