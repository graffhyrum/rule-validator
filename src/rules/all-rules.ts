import { noExpectTypeofToBeRule } from "./no-expect-typeof-tobe.js";
import { noNonNullAssertionRule } from "./no-non-null-assertion.js";
import { noStaticClassesRule } from "./no-static-classes.js";
import { noToBeInstanceOfRule } from "./no-to-be-instance-of.js";
import { noUnknownAsCastRule } from "./no-unknown-as-cast.js";
import { noWaitForTimeoutRule } from "./no-wait-for-timeout.js";
import type { ASTRule } from "./rule.js";
import { templateLiteralsOnlyRule } from "./template-literals-only.js";

export const AST_RULES: ASTRule[] = [
	noExpectTypeofToBeRule,
	noNonNullAssertionRule,
	noStaticClassesRule,
	noToBeInstanceOfRule,
	noUnknownAsCastRule,
	noWaitForTimeoutRule,
	templateLiteralsOnlyRule,
];
