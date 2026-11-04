/**
 * Types for the business API (budgets, expenses, payments, goals, performance and reports),
 * mirroring backend dto/FinanceDtos, GoalDtos and ReportDtos. Money arrives as a JSON number in
 * the organisation's one currency (the `currency` field next to it); dates are ISO strings
 * ("2026-05-14"), timestamps ISO date-times.
 */
import type { IsoDateTime } from "./types";

/** "2026-05-14" */
export type IsoDate = string;
/** "2026-05" */
export type IsoMonth = string;

// ---- Categories and budgets -------------------------------------------------------------

/** FinanceDtos.CategoryDto */
export interface ExpenseCategory {
    id: number;
    name: string;
    description: string | null;
    /** Inactive categories stay on old records but cannot be picked for new ones. */
    active: boolean;
    /** Budget lines plus expenses that use this category. */
    usageCount: number;
}

export interface ExpenseCategoryRequest {
    name: string;
    description?: string | null;
    active?: boolean;
}

/** FinanceDtos.BudgetLine. A null id means spending without a budget line (amount 0). */
export interface BudgetLine {
    id: number | null;
    departmentId: number;
    departmentName: string;
    departmentColor: string | null;
    categoryId: number;
    categoryName: string;
    year: number;
    quarter: number;
    amount: number;
    /** APPROVED plus PAID expenses dated in the quarter. */
    spent: number;
    /** SUBMITTED expenses dated in the quarter. */
    committed: number;
    /** amount - spent - committed; negative when over budget. */
    remaining: number;
    currency: string;
    notes: string | null;
    updatedAt: IsoDateTime | null;
}

export interface MoneyTotals {
    budget: number;
    spent: number;
    committed: number;
    remaining: number;
}

/** FinanceDtos.BudgetSummary */
export interface BudgetSummary {
    year: number;
    quarter: number | null;
    departmentId: number | null;
    currency: string;
    lines: BudgetLine[];
    totals: MoneyTotals;
}

export interface BudgetRequest {
    departmentId: number;
    categoryId: number;
    year: number;
    quarter: number;
    amount: number;
    notes?: string | null;
}

// ---- Expenses ---------------------------------------------------------------------------

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

/** FinanceDtos.Actions: what the caller may do with the expense right now. */
export interface ExpenseActions {
    edit: boolean;
    submit: boolean;
    approve: boolean;
    reject: boolean;
    pay: boolean;
    delete: boolean;
}

/** FinanceDtos.ExpenseDto */
export interface Expense {
    id: number;
    departmentId: number;
    departmentName: string;
    categoryId: number;
    categoryName: string;
    amount: number;
    currency: string;
    date: IsoDate;
    vendor: string;
    description: string | null;
    reference: string | null;
    status: ExpenseStatus;
    /** True when, at submission, the amount exceeded the remaining budget of its line. */
    overBudget: boolean;
    submittedById: number | null;
    submittedByName: string | null;
    submittedByEmail: string | null;
    submittedAt: IsoDateTime | null;
    decidedByEmail: string | null;
    decidedAt: IsoDateTime | null;
    decisionNote: string | null;
    paidOn: IsoDate | null;
    paidByEmail: string | null;
    paymentReference: string | null;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
    actions: ExpenseActions;
}

/** FinanceDtos.ExpensePage */
export interface ExpensePage {
    items: Expense[];
    page: number;
    size: number;
    totalItems: number;
    totalPages: number;
    /** Sum of every matching expense, not only this page. */
    totalAmount: number;
    currency: string;
}

export interface ExpenseRequest {
    departmentId?: number | null;
    categoryId: number;
    amount: number;
    date: IsoDate;
    vendor: string;
    description?: string | null;
    reference?: string | null;
    /** Create only: true submits it straight away instead of saving a draft. */
    submit?: boolean;
}

// ---- Payments ---------------------------------------------------------------------------

/** FinanceDtos.PaymentDto: a PAID expense. */
export interface Payment {
    expenseId: number;
    paidOn: IsoDate;
    amount: number;
    currency: string;
    vendor: string;
    description: string | null;
    reference: string | null;
    paymentReference: string | null;
    departmentId: number;
    departmentName: string;
    categoryId: number;
    categoryName: string;
    submittedByEmail: string | null;
    paidByEmail: string | null;
}

export interface PaymentMonth {
    month: IsoMonth;
    total: number;
    count: number;
}

/** FinanceDtos.PaymentLedger */
export interface PaymentLedger {
    from: IsoDate;
    to: IsoDate;
    currency: string;
    totalAmount: number;
    count: number;
    /** Every month in the range, oldest first, including empty ones. */
    months: PaymentMonth[];
    /** This page of payments, newest first. */
    items: Payment[];
    page: number;
    size: number;
    totalPages: number;
    provider: { connected: boolean; note: string };
}

// ---- Goals and performance --------------------------------------------------------------

export type GoalDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

/** GoalDtos.GoalDto */
export interface Goal {
    id: number;
    departmentId: number;
    departmentName: string;
    name: string;
    description: string | null;
    unit: string;
    direction: GoalDirection;
    baseline: number;
    target: number;
    weight: number;
    year: number;
    quarter: number;
    ownerId: number | null;
    ownerName: string | null;
    /** Value of the latest check-in; null when there is none. */
    currentValue: number | null;
    lastCheckinDate: IsoDate | null;
    checkinCount: number;
    /** Progress from baseline to target in percent, 0..120; null without check-ins. */
    attainment: number | null;
    canEdit: boolean;
    canCheckIn: boolean;
    createdAt: IsoDateTime;
    updatedAt: IsoDateTime;
}

export interface GoalRequest {
    departmentId?: number | null;
    name: string;
    description?: string | null;
    unit: string;
    direction: GoalDirection;
    baseline: number;
    target: number;
    weight?: number;
    year?: number;
    quarter?: number;
    ownerId?: number | null;
}

/** GoalDtos.CheckinDto */
export interface GoalCheckin {
    id: number;
    goalId: number;
    date: IsoDate;
    value: number;
    note: string | null;
    source: "UI" | "CSV" | "API";
    /** Email of the person, or "API key: name" for integrations. */
    recordedBy: string | null;
    createdAt: IsoDateTime;
    canDelete: boolean;
}

export interface CheckinRequest {
    date?: IsoDate;
    value: number;
    note?: string | null;
}

/** GoalDtos.GoalAttainment */
export interface GoalAttainment {
    goalId: number;
    name: string;
    unit: string;
    direction: GoalDirection;
    baseline: number;
    target: number;
    weight: number;
    currentValue: number | null;
    lastCheckinDate: IsoDate | null;
    attainment: number | null;
}

export interface TrendPoint {
    month: IsoMonth;
    /** Department score at the end of the month; null when no goal had data. */
    score: number | null;
}

/** GoalDtos.DepartmentPerformance */
export interface DepartmentPerformance {
    departmentId: number;
    departmentName: string;
    departmentColor: string | null;
    /** Weighted average attainment of the goals with check-ins; null when none has. */
    score: number | null;
    goalCount: number;
    goalsWithData: number;
    goals: GoalAttainment[];
    /** Six monthly scores, oldest first. */
    trend: TrendPoint[];
}

export interface PerformanceOverview {
    year: number;
    quarter: number;
    departments: DepartmentPerformance[];
}

// ---- Reports ----------------------------------------------------------------------------

export interface ReportOverview {
    from: IsoDate;
    to: IsoDate;
    currency: string;
    performanceYear: number;
    performanceQuarter: number;
    totals: MoneyTotals & { activeHeadcount: number };
    spendByDepartment: { departmentId: number; departmentName: string; departmentColor: string | null; spent: number }[];
    spendByCategory: { categoryId: number; categoryName: string; spent: number }[];
    budgetVsSpend: {
        departmentId: number;
        departmentName: string;
        departmentColor: string | null;
        budget: number;
        spent: number;
        committed: number;
        remaining: number;
        /** spent / budget in percent; null when there is no budget. */
        utilisation: number | null;
    }[];
    /** Every month in the range, oldest first. */
    monthlySpend: { month: IsoMonth; spent: number; committed: number }[];
    performance: { departmentId: number; departmentName: string; departmentColor: string | null; score: number | null }[];
    /** Users per department; departmentId is null for unassigned users. */
    headcount: { departmentId: number | null; departmentName: string | null; active: number; total: number }[];
}

export type ReportExportType = "expenses" | "budgets" | "performance";
