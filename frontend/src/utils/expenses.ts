/**
 * Expense statuses, the row actions offered for an expense, the tabs of the Expenses page and
 * the form rules (mirroring ExpenseService.apply). The backend decides what the caller may do:
 * the actions come from each expense's `actions` flags, never from the role.
 */
import { Banknote, CircleCheck, CircleX, Clock3, FilePen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Expense, ExpenseActions, ExpenseStatus } from "../api/business";
import { hasPermission } from "../auth/permissions";
import type { UserLike } from "../auth/permissions";
import { decimalProblem } from "./goals";

export const EXPENSE_STATUSES: readonly ExpenseStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"];

export const STATUS_META: Record<ExpenseStatus, { label: string; tone: "neutral" | "info" | "ok" | "danger"; Icon: LucideIcon }> = {
    DRAFT: { label: "Draft", tone: "neutral", Icon: FilePen },
    SUBMITTED: { label: "Awaiting approval", tone: "info", Icon: Clock3 },
    APPROVED: { label: "Approved", tone: "ok", Icon: CircleCheck },
    REJECTED: { label: "Rejected", tone: "danger", Icon: CircleX },
    PAID: { label: "Paid", tone: "ok", Icon: Banknote },
};

export type ExpenseActionKey = keyof ExpenseActions;

export interface ExpenseAction {
    key: ExpenseActionKey;
    label: string;
    variant: "primary" | "secondary" | "ghost-danger";
    /** Opens a dialog first: a note (reject), payment details (pay) or a confirmation (delete). */
    confirm: boolean;
}

/** In the order they are offered: the decision first, destructive last. */
const ACTIONS: readonly ExpenseAction[] = [
    { key: "approve", label: "Approve", variant: "primary", confirm: false },
    { key: "pay", label: "Mark paid", variant: "primary", confirm: true },
    { key: "submit", label: "Submit", variant: "primary", confirm: false },
    { key: "edit", label: "Edit", variant: "secondary", confirm: false },
    { key: "reject", label: "Reject", variant: "ghost-danger", confirm: true },
    { key: "delete", label: "Delete draft", variant: "ghost-danger", confirm: true },
];

/** The actions the caller may take on this expense right now, from its `actions` flags. */
export function expenseActions(expense: Pick<Expense, "actions">): ExpenseAction[] {
    const flags = expense.actions;
    if (!flags) return [];
    return ACTIONS.filter((a) => flags[a.key]);
}

export type ExpenseTab = "mine" | "approve" | "all";

/** The tabs this user gets: Mine always, To approve for approvers, All with FINANCE_READ. */
export function expenseTabs(user: UserLike | null | undefined): ExpenseTab[] {
    const tabs: ExpenseTab[] = ["mine"];
    if (hasPermission(user, "EXPENSE_APPROVE") || hasPermission(user, "FINANCE_MANAGE")) tabs.push("approve");
    if (hasPermission(user, "FINANCE_READ")) tabs.push("all");
    return tabs;
}

export const TAB_LABELS: Record<ExpenseTab, string> = { mine: "Mine", approve: "To approve", all: "All" };

/**
 * The fixed query of a tab. "Mine" is the caller's own expenses; "To approve" is what is
 * submitted, in the approver's department unless they may approve anywhere (FINANCE_MANAGE).
 */
export function tabQuery(
    tab: ExpenseTab,
    user: (UserLike & { id?: number; departmentId?: number | null }) | null | undefined,
): Record<string, string> {
    if (tab === "mine") return user?.id !== undefined ? { submitterId: String(user.id) } : {};
    if (tab === "approve") {
        const query: Record<string, string> = { status: "SUBMITTED" };
        if (!hasPermission(user, "FINANCE_MANAGE") && user?.departmentId != null) query.departmentId = String(user.departmentId);
        return query;
    }
    return {};
}

export interface ExpenseForm {
    departmentId: string;
    categoryId: string;
    amount: string;
    date: string;
    vendor: string;
    description: string;
    reference: string;
}

/** The first problem with an expense form, or null. `today` is an ISO date. Mirrors ExpenseService.apply. */
export function expenseFormProblem(form: ExpenseForm, today: string): string | null {
    if (!form.categoryId) return "Choose a category.";
    const amount = decimalProblem(form.amount, "Amount", { positive: true });
    if (amount) return amount;
    if (!form.date) return "Date is required.";
    if (form.date > today) return "The expense date cannot be in the future.";
    if (form.date < "2000-01-01") return "The expense date is too far in the past.";
    const vendor = form.vendor.trim();
    if (!vendor) return "Vendor is required.";
    if (vendor.length > 120) return "Vendor must be at most 120 characters.";
    if (form.description.trim().length > 500) return "Description must be at most 500 characters.";
    if (form.reference.trim().length > 80) return "Reference must be at most 80 characters.";
    return null;
}
