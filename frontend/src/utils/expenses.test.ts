import { describe, expect, it } from "vitest";
import type { ExpenseActions } from "../api/business";
import { STATUS_META, expenseActions, expenseFormProblem, expenseTabs, tabQuery } from "./expenses";
import type { ExpenseForm } from "./expenses";

const none: ExpenseActions = { edit: false, submit: false, approve: false, reject: false, pay: false, delete: false };

describe("expenseActions", () => {
    it("offers only what the API allows, decision first and destructive last", () => {
        expect(expenseActions({ actions: none })).toEqual([]);
        expect(expenseActions({ actions: { ...none, approve: true, reject: true } }).map((a) => a.key)).toEqual(["approve", "reject"]);
        expect(expenseActions({ actions: { ...none, edit: true, submit: true, delete: true } }).map((a) => a.key)).toEqual(["submit", "edit", "delete"]);
        expect(expenseActions({ actions: { ...none, pay: true } }).map((a) => a.label)).toEqual(["Mark paid"]);
    });

    it("asks for a note, payment details or a confirmation before reject, pay and delete", () => {
        const all = expenseActions({ actions: { edit: true, submit: true, approve: true, reject: true, pay: true, delete: true } });
        expect(all.filter((a) => a.confirm).map((a) => a.key)).toEqual(["pay", "reject", "delete"]);
        expect(all.filter((a) => a.variant === "ghost-danger").map((a) => a.key)).toEqual(["reject", "delete"]);
    });

    it("copes with a missing actions object", () => {
        expect(expenseActions({} as never)).toEqual([]);
    });

    it("gives every status an icon and a label", () => {
        for (const meta of Object.values(STATUS_META)) {
            expect(meta.label).toBeTruthy();
            expect(meta.Icon).toBeTruthy();
        }
        expect(STATUS_META.SUBMITTED.label).toBe("Awaiting approval");
    });
});

describe("expense tabs", () => {
    const member = { permissions: ["EXPENSE_SUBMIT"] };
    const manager = { id: 4, departmentId: 2, permissions: ["EXPENSE_SUBMIT", "EXPENSE_APPROVE", "FINANCE_READ"] };
    const admin = { id: 1, departmentId: null, permissions: ["EXPENSE_SUBMIT", "EXPENSE_APPROVE", "FINANCE_READ", "FINANCE_MANAGE"] };

    it("shows To approve to approvers and All to finance readers", () => {
        expect(expenseTabs(member)).toEqual(["mine"]);
        expect(expenseTabs(manager)).toEqual(["mine", "approve", "all"]);
        expect(expenseTabs({ permissions: ["FINANCE_READ"] })).toEqual(["mine", "all"]);
    });

    it("queries the caller's own expenses, or what waits for them", () => {
        expect(tabQuery("mine", manager)).toEqual({ submitterId: "4" });
        expect(tabQuery("approve", manager)).toEqual({ status: "SUBMITTED", departmentId: "2" });
        expect(tabQuery("approve", admin)).toEqual({ status: "SUBMITTED" });
        expect(tabQuery("all", admin)).toEqual({});
    });
});

describe("expense form rules (mirror ExpenseService)", () => {
    const today = "2026-11-04";
    const valid: ExpenseForm = { departmentId: "2", categoryId: "3", amount: "249.00", date: "2026-11-01", vendor: "Dell", description: "", reference: "" };

    it("accepts a valid expense", () => {
        expect(expenseFormProblem(valid, today)).toBeNull();
    });

    it("checks category, amount, date and vendor", () => {
        expect(expenseFormProblem({ ...valid, categoryId: "" }, today)).toBe("Choose a category.");
        expect(expenseFormProblem({ ...valid, amount: "0" }, today)).toBe("Amount must be greater than zero.");
        expect(expenseFormProblem({ ...valid, amount: "1.999" }, today)).toBe("Amount can have at most 2 decimals.");
        expect(expenseFormProblem({ ...valid, date: "2026-11-05" }, today)).toBe("The expense date cannot be in the future.");
        expect(expenseFormProblem({ ...valid, date: "1999-12-31" }, today)).toBe("The expense date is too far in the past.");
        expect(expenseFormProblem({ ...valid, vendor: " " }, today)).toBe("Vendor is required.");
        expect(expenseFormProblem({ ...valid, reference: "x".repeat(81) }, today)).toBe("Reference must be at most 80 characters.");
    });
});
