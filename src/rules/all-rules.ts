import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";
import { noStaticClassesRule } from "./no-static-classes.js";
import { noToBeInstanceOfRule } from "./no-to-be-instance-of.js";
import { noUnknownAsCastRule } from "./no-unknown-as-cast.js";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";
import type { ASTRule } from "./rule.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";

// `no-raw-response-in-elysia` is intentionally absent here: detecting `new Response()`
// (excluding proc.stdout) is a structural surface-pattern that regex handles reliably
// without needing scope, type, or control-flow information from a full AST walk.
export const AST_RULES: ASTRule[] = [
	noExpectTypeofToBeRule,
	noNonNullAssertionRule,
	noStaticClassesRule,
	noToBeInstanceOfRule,
	noUnknownAsCastRule,
	noWaitForTimeoutRule,
	templateLiteralsOnlyRule,
];
