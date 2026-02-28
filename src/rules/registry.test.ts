import { describe, expect, it, mock } from "bun:test";
import {
	clearRules,
	getAllRules,
	getRule,
	getRuleCount,
	getRulesBySeverity,
	registerRule,
} from "./registry.js";
import type { ASTRule } from "./rule.js";

// Helper to create mock ASTRule objects
const createMockRule = (name: string, severity: "error" | "warning" = "error"): ASTRule => ({
	name,
	description: `Test rule ${name}`,
	severity,
	visit: mock(() => {}),
});

describe("registerRule", () => {
	it("should register a rule successfully", () => {
		clearRules();
		const rule = createMockRule("register-test-rule");
		expect(() => registerRule(rule)).not.toThrow();
		expect(getRuleCount()).toBe(1);
		expect(getRule("register-test-rule")).toEqual(rule);
		clearRules();
	});

	it("should throw error when registering duplicate rule", () => {
		clearRules();
		const rule = createMockRule("duplicate-test-rule");
		registerRule(rule);
		expect(() => registerRule(rule)).toThrow('Rule "duplicate-test-rule" is already registered');
		clearRules();
	});
});

describe("getRule", () => {
	it("should return rule when it exists", () => {
		clearRules();
		const rule = createMockRule("get-rule-test");
		registerRule(rule);
		const retrieved = getRule("get-rule-test");
		expect(retrieved).toEqual(rule);
		clearRules();
	});

	it("should return undefined when rule does not exist", () => {
		clearRules();
		const rule = getRule("non-existent-rule");
		expect(rule).toBeUndefined();
		clearRules();
	});
});

describe("getAllRules", () => {
	it("should return empty array when no rules registered", () => {
		clearRules();
		const rules = getAllRules();
		expect(rules).toEqual([]);
		clearRules();
	});

	it("should return all registered rules", () => {
		clearRules();
		const rule1 = createMockRule("all-rules-test-1");
		const rule2 = createMockRule("all-rules-test-2");
		registerRule(rule1);
		registerRule(rule2);
		const rules = getAllRules();
		expect(rules).toHaveLength(2);
		expect(rules).toContain(rule1);
		expect(rules).toContain(rule2);
		clearRules();
	});
});

describe("getRulesBySeverity", () => {
	it("should return only error rules", () => {
		clearRules();
		const errorRule1 = createMockRule("severity-error-1", "error");
		const warningRule = createMockRule("severity-warning", "warning");
		const errorRule2 = createMockRule("severity-error-2", "error");
		registerRule(errorRule1);
		registerRule(warningRule);
		registerRule(errorRule2);
		const errorRules = getRulesBySeverity("error");
		expect(errorRules).toHaveLength(2);
		expect(errorRules).toContain(errorRule1);
		expect(errorRules).toContain(errorRule2);
		clearRules();
	});

	it("should return only warning rules", () => {
		clearRules();
		const errorRule = createMockRule("severity-test-error", "error");
		const warningRule = createMockRule("severity-test-warning", "warning");
		registerRule(errorRule);
		registerRule(warningRule);
		const warningRules = getRulesBySeverity("warning");
		expect(warningRules).toHaveLength(1);
		expect(warningRules).toContain(warningRule);
		clearRules();
	});

	it("should return empty array when no rules match severity", () => {
		clearRules();
		const errorRules = getRulesBySeverity("error");
		expect(errorRules).toEqual([]);
		clearRules();
	});
});

describe("clearRules", () => {
	it("should clear all rules", () => {
		clearRules();
		const rule1 = createMockRule("clear-test-1");
		const rule2 = createMockRule("clear-test-2");
		registerRule(rule1);
		registerRule(rule2);
		expect(getRuleCount()).toBe(2);

		clearRules();
		expect(getRuleCount()).toBe(0);
		expect(getAllRules()).toEqual([]);
		clearRules();
	});
});

describe("getRuleCount", () => {
	it("should return 0 when no rules registered", () => {
		clearRules();
		expect(getRuleCount()).toBe(0);
		clearRules();
	});

	it("should return correct count after registering rules", () => {
		clearRules();
		const rule1 = createMockRule("count-test-1");
		const rule2 = createMockRule("count-test-2");
		registerRule(rule1);
		expect(getRuleCount()).toBe(1);

		registerRule(rule2);
		expect(getRuleCount()).toBe(2);
		clearRules();
	});

	it("should return 0 after clearing rules", () => {
		clearRules();
		const rule1 = createMockRule("clear-count-test-1");
		const rule2 = createMockRule("clear-count-test-2");
		registerRule(rule1);
		registerRule(rule2);
		expect(getRuleCount()).toBe(2);

		clearRules();
		expect(getRuleCount()).toBe(0);
		clearRules();
	});
});
