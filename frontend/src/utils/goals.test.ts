import { describe, expect, it } from "vitest";
import {
    attainmentStatus, attainmentWidth, checkinProblem, decimalProblem, directionHint, formatGoalValue, goalFormProblem, parseDecimal,
} from "./goals";
import type { GoalForm } from "./goals";

describe("attainment display", () => {
    it("labels the progress toward the target", () => {
        expect(attainmentStatus(null)).toEqual({ tone: "neutral", label: "No check-ins yet" });
        expect(attainmentStatus(120)).toEqual({ tone: "ok", label: "Target met" });
        expect(attainmentStatus(100)).toEqual({ tone: "ok", label: "Target met" });
        expect(attainmentStatus(72)).toEqual({ tone: "info", label: "On track" });
        expect(attainmentStatus(45)).toEqual({ tone: "warn", label: "Behind" });
        expect(attainmentStatus(0)).toEqual({ tone: "danger", label: "At risk" });
    });

    it("fills the bar up to the target, never past it", () => {
        expect(attainmentWidth(null)).toBe(0);
        expect(attainmentWidth(44.6)).toBe(44.6);
        expect(attainmentWidth(118)).toBe(100);
        expect(attainmentWidth(-5)).toBe(0);
    });

    it("hints which way is better", () => {
        expect(directionHint("HIGHER_IS_BETTER")).toBe("Higher is better");
        expect(directionHint("LOWER_IS_BETTER")).toBe("Lower is better");
    });

    it("formats values with their unit", () => {
        expect(formatGoalValue(87.8, "%")).toMatch(/^87[.,]8%$/);
        expect(formatGoalValue(7, "days")).toBe("7 days");
        expect(formatGoalValue(4.8, "EUR")).toMatch(/4[.,]80/);
        expect(formatGoalValue(null, "days")).toBe("—");
    });
});

describe("goal form rules (mirror GoalService)", () => {
    const valid: GoalForm = {
        departmentId: "2", name: "Sprint velocity", description: "", unit: "points", direction: "HIGHER_IS_BETTER",
        baseline: "42", target: "55", weight: "3", ownerId: "",
    };

    it("accepts a valid goal", () => {
        expect(goalFormProblem(valid)).toBeNull();
        expect(goalFormProblem({ ...valid, weight: "" })).toBeNull();
    });

    it("requires the target to agree with the direction", () => {
        expect(goalFormProblem({ ...valid, target: "42" })).toBe("When higher is better, the target must be above the baseline.");
        expect(goalFormProblem({ ...valid, target: "40" })).toBe("When higher is better, the target must be above the baseline.");
        expect(goalFormProblem({ ...valid, direction: "LOWER_IS_BETTER" })).toBe("When lower is better, the target must be below the baseline.");
        expect(goalFormProblem({ ...valid, direction: "LOWER_IS_BETTER", baseline: "9", target: "5" })).toBeNull();
    });

    it("checks name, unit, numbers and weight", () => {
        expect(goalFormProblem({ ...valid, name: "  " })).toBe("Goal name is required.");
        expect(goalFormProblem({ ...valid, name: "x".repeat(121) })).toBe("Goal name must be at most 120 characters.");
        expect(goalFormProblem({ ...valid, unit: "" })).toMatch(/^Unit is required/);
        expect(goalFormProblem({ ...valid, unit: "x".repeat(21) })).toBe("Unit must be at most 20 characters.");
        expect(goalFormProblem({ ...valid, baseline: "abc" })).toBe("Baseline must be a number.");
        expect(goalFormProblem({ ...valid, target: "55.123" })).toBe("Target can have at most 2 decimals.");
        expect(goalFormProblem({ ...valid, weight: "0" })).toMatch(/^Weight/);
        expect(goalFormProblem({ ...valid, weight: "101" })).toMatch(/^Weight/);
        expect(goalFormProblem({ ...valid, weight: "2.5" })).toMatch(/^Weight/);
    });
});

describe("numbers as typed", () => {
    it("parses dots, commas and spaces like Money.parse", () => {
        expect(parseDecimal("1 234.50")).toBe(1234.5);
        expect(parseDecimal("1234,5")).toBe(1234.5);
        expect(parseDecimal("1,234.5")).toBe(1234.5);
        expect(parseDecimal("-3")).toBe(-3);
        expect(parseDecimal("12a")).toBeNull();
        expect(parseDecimal("")).toBeNull();
    });

    it("reports amount problems", () => {
        expect(decimalProblem("", "Amount")).toBe("Amount is required.");
        expect(decimalProblem("0", "Amount", { positive: true })).toBe("Amount must be greater than zero.");
        expect(decimalProblem("10.500", "Amount")).toBeNull();
        expect(decimalProblem("1000000000000", "Amount")).toBe("Amount is too large.");
    });
});

describe("check-in rules", () => {
    const bounds = { min: "2026-10-01", max: "2026-11-04" };
    it("keeps the date inside the quarter and not in the future", () => {
        expect(checkinProblem({ date: "2026-11-01", value: "3", note: "" }, bounds)).toBeNull();
        expect(checkinProblem({ date: "2026-09-30", value: "3", note: "" }, bounds)).toMatch(/^The date must be between/);
        expect(checkinProblem({ date: "2026-11-05", value: "3", note: "" }, bounds)).toMatch(/^The date must be between/);
        expect(checkinProblem({ date: "", value: "3", note: "" }, bounds)).toBe("Choose the date of the value.");
        expect(checkinProblem({ date: "2026-11-01", value: "", note: "" }, bounds)).toBe("Value is required.");
    });
});
