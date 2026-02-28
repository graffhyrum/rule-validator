import type { ASTRule } from "./rule.js";

type Severity = "error" | "warning";

export function getRulesBySeverity(severity: Severity): ASTRule[] {
	return getAllRules().filter((r: ASTRule) => r.severity === severity);
}
export function registerRule(rule: ASTRule): void {
	if (rules.has(rule.name)) {
		throw new Error(`Rule "${rule.name}" is already registered`);
	}
	rules.set(rule.name, rule);
}
export function getRule(name: string): ASTRule | undefined {
	return rules.get(name);
}
export function getAllRules(): ASTRule[] {
	return Array.from(rules.values());
}
export function clearRules(): void {
	rules.clear();
}
export function getRuleCount(): number {
	return rules.size;
}
const rules = new Map<string, ASTRule>();
