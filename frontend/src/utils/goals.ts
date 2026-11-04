/**
 * Display and validation logic for goals (KPIs) and check-ins. The validation mirrors
 * GoalService.apply and Money on the backend; the backend has the last word.
 */
import type { GoalDirection } from "../api/business";
import { formatMoney, formatNumber } from "./money";

export type AttainmentTone = "ok" | "info" | "warn" | "danger" | "neutral";

/**
 * How a goal or department is doing, from its attainment (progress from baseline to target,
 * 0..120, null without check-ins). Always shown as an icon and a label, never colour alone.
 */
export function attainmentStatus(attainment: number | null | undefined): { tone: AttainmentTone; label: string } {
    if (attainment === null || attainment === undefined) return { tone: "neutral", label: "No check-ins yet" };
    if (attainment >= 100) return { tone: "ok", label: "Target met" };
    if (attainment >= 60) return { tone: "info", label: "On track" };
    if (attainment >= 30) return { tone: "warn", label: "Behind" };
    return { tone: "danger", label: "At risk" };
}

/** The width of the attainment bar in percent of the target: 0..100 (past the target stays full). */
export function attainmentWidth(attainment: number | null | undefined): number {
    if (attainment === null || attainment === undefined || !Number.isFinite(attainment)) return 0;
    return Math.max(0, Math.min(100, attainment));
}

/** "Higher is better" or "Lower is better". */
export function directionHint(direction: GoalDirection): string {
    return direction === "LOWER_IS_BETTER" ? "Lower is better" : "Higher is better";
}

const CURRENCY_UNIT = /^[A-Z]{3}$/;

/**
 * A goal value with its unit: "87.8%", "7 days", "€12,000.00" (a three-letter upper-case unit is
 * taken as a currency). Null shows an em dash.
 */
export function formatGoalValue(value: number | null | undefined, unit: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const u = unit.trim();
    if (u === "%") return `${formatNumber(value)}%`;
    if (CURRENCY_UNIT.test(u)) return formatMoney(value, u);
    return u ? `${formatNumber(value)} ${u}` : formatNumber(value);
}

export interface GoalForm {
    departmentId: string;
    name: string;
    description: string;
    unit: string;
    direction: GoalDirection;
    baseline: string;
    target: string;
    weight: string;
    ownerId: string;
}

/** Same limit as Money.MAX on the backend. */
const MAX_VALUE = 999_999_999_999.99;

/** Parses a typed number ("1 234,5" or "1234.50"); null when it is not one. */
export function parseDecimal(raw: string): number | null {
    let cleaned = raw.trim().replace(/\s/g, "");
    if (!cleaned) return null;
    if (cleaned.includes(",") && !cleaned.includes(".")) cleaned = cleaned.replace(",", ".");
    else cleaned = cleaned.replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return Number(cleaned);
}

/** At most two decimals, like Money.requireAmount. */
export function decimalProblem(raw: string, field: string, { positive = false } = {}): string | null {
    if (!raw.trim()) return `${field} is required.`;
    const value = parseDecimal(raw);
    if (value === null) return `${field} must be a number.`;
    const decimals = raw.trim().replace(/\s/g, "").split(/[.,]/)[1];
    if (decimals && decimals.replace(/0+$/, "").length > 2) return `${field} can have at most 2 decimals.`;
    if (Math.abs(value) > MAX_VALUE) return `${field} is too large.`;
    if (positive && value <= 0) return `${field} must be greater than zero.`;
    return null;
}

/** The first problem with a goal form, or null. Mirrors GoalService.apply. */
export function goalFormProblem(form: GoalForm): string | null {
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) return "Goal name is required.";
    if (name.length > 120) return "Goal name must be at most 120 characters.";
    const unit = form.unit.trim();
    if (!unit) return "Unit is required (for example %, count, hours or EUR).";
    if (unit.length > 20) return "Unit must be at most 20 characters.";
    if (form.description.trim().length > 500) return "Description must be at most 500 characters.";
    const baselineProblem = decimalProblem(form.baseline, "Baseline");
    if (baselineProblem) return baselineProblem;
    const targetProblem = decimalProblem(form.target, "Target");
    if (targetProblem) return targetProblem;
    const baseline = parseDecimal(form.baseline) as number;
    const target = parseDecimal(form.target) as number;
    if (form.direction === "HIGHER_IS_BETTER" && target <= baseline) {
        return "When higher is better, the target must be above the baseline.";
    }
    if (form.direction === "LOWER_IS_BETTER" && target >= baseline) {
        return "When lower is better, the target must be below the baseline.";
    }
    const weight = form.weight.trim() === "" ? 1 : Number(form.weight);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) return "Weight must be a whole number between 1 and 100.";
    return null;
}

/** The first problem with a check-in, or null. Mirrors GoalService (date in the quarter, not in the future). */
export function checkinProblem(input: { date: string; value: string; note: string }, bounds: { min: string; max: string }): string | null {
    if (!input.date) return "Choose the date of the value.";
    if (input.date < bounds.min || input.date > bounds.max) {
        return `The date must be between ${bounds.min} and ${bounds.max} (inside the goal's quarter, not in the future).`;
    }
    const problem = decimalProblem(input.value, "Value");
    if (problem) return problem;
    if (input.note.trim().length > 500) return "The note must be at most 500 characters.";
    return null;
}
