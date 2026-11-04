/**
 * Pure logic behind the people pages: the Users page filters and their URL form, bulk results,
 * eligible department managers and budget figures per department. Tested in people.test.ts.
 */
import type { RoleName, UserDto, UserStatus } from "../api/types";
import type { BudgetLineLite, BulkUserResult, UserSort, UserSortField } from "../api/people";
import { hasRole, ROLES, STATUSES } from "../auth/permissions";

export const USERS_PAGE_SIZE = 25;
export const DEFAULT_USER_SORT: UserSort = "name";

const SORT_FIELDS: readonly UserSortField[] = ["name", "email", "department", "status", "createdAt", "lastLoginAt"];

/** The Users page filters. `page` is 1-based, as shown and as in the URL. */
export interface UserFilters {
    q: string;
    role: RoleName | "";
    status: UserStatus | "";
    departmentId: number | null;
    sort: UserSort;
    page: number;
}

export const EMPTY_USER_FILTERS: UserFilters = {
    q: "",
    role: "",
    status: "",
    departmentId: null,
    sort: DEFAULT_USER_SORT,
    page: 1,
};

function isSort(value: string): value is UserSort {
    const field = value.startsWith("-") ? value.slice(1) : value;
    return (SORT_FIELDS as readonly string[]).includes(field);
}

function positiveInt(value: string | null): number | null {
    if (!value || !/^\d+$/.test(value)) return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Reads the filters from the query string (`?q=&role=&status=&dept=&sort=&page=`). Anything
 * missing or invalid falls back to its default, so a hand-edited URL never breaks the page.
 */
export function readUserFilters(params: URLSearchParams): UserFilters {
    const role = (params.get("role") ?? "").toUpperCase();
    const status = params.get("status") ?? "";
    const sort = params.get("sort") ?? "";
    return {
        q: (params.get("q") ?? "").trim(),
        role: (ROLES as readonly string[]).includes(role) ? (role as RoleName) : "",
        status: (STATUSES as readonly string[]).includes(status) ? (status as UserStatus) : "",
        departmentId: positiveInt(params.get("dept")),
        sort: isSort(sort) ? sort : DEFAULT_USER_SORT,
        page: positiveInt(params.get("page")) ?? 1,
    };
}

/** The query string for the filters, leaving out defaults so a clean page has a clean URL. */
export function writeUserFilters(filters: UserFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.role) params.set("role", filters.role);
    if (filters.status) params.set("status", filters.status);
    if (filters.departmentId != null) params.set("dept", String(filters.departmentId));
    if (filters.sort !== DEFAULT_USER_SORT) params.set("sort", filters.sort);
    if (filters.page > 1) params.set("page", String(filters.page));
    return params;
}

/**
 * Changes some filters. Any change other than the page itself goes back to page 1, because the
 * old page number means nothing in a different result set.
 */
export function updateUserFilters(current: UserFilters, change: Partial<UserFilters>): UserFilters {
    const next = { ...current, ...change };
    const onlyPage = Object.keys(change).every((k) => k === "page");
    if (!onlyPage) next.page = change.page ?? 1;
    return next;
}

/** Whether any filter (not the sort or page) narrows the list. */
export function hasUserFilters(filters: UserFilters): boolean {
    return Boolean(filters.q || filters.role || filters.status || filters.departmentId != null);
}

/** The /api/users/search path for the filters (the API's `page` is zero-based). */
export function userSearchPath(filters: UserFilters, size = USERS_PAGE_SIZE): string {
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.role) params.set("role", filters.role);
    if (filters.status) params.set("status", filters.status);
    if (filters.departmentId != null) params.set("departmentId", String(filters.departmentId));
    params.set("sort", filters.sort);
    params.set("page", String(Math.max(0, filters.page - 1)));
    params.set("size", String(size));
    return `/api/users/search?${params.toString()}`;
}

/** Clicking a column header: the same column flips direction, another column sorts ascending. */
export function nextSort(current: UserSort, field: UserSortField): UserSort {
    if (current === field) return `-${field}`;
    return field;
}

/** The `aria-sort` value of a column header. */
export function sortDirection(current: UserSort, field: UserSortField): "ascending" | "descending" | "none" {
    if (current === field) return "ascending";
    if (current === `-${field}`) return "descending";
    return "none";
}

/** "Showing 26–50 of 61" for a page of results. */
export function rangeLabel(page: number, size: number, shown: number, total: number): string {
    if (total === 0 || shown === 0) return "No users";
    const from = (page - 1) * size + 1;
    return `Showing ${from}–${from + shown - 1} of ${total}`;
}

// ---- Bulk changes ----------------------------------------------------------------------

export interface BulkFailure {
    id: number;
    name: string;
    message: string;
}

export interface BulkSummary {
    succeeded: number;
    failed: number;
    failures: BulkFailure[];
    /** One sentence for the result banner. */
    headline: string;
    tone: "ok" | "warn" | "danger";
}

const people = (n: number) => `${n} ${n === 1 ? "user" : "users"}`;

/**
 * Turns a bulk result into what the page shows: counts, a headline, and each failure with the
 * person's name (looked up in `names`, falling back to the id) and the API's message.
 */
export function summariseBulk(result: BulkUserResult, names: ReadonlyMap<number, string>, verb = "Updated"): BulkSummary {
    const failures = result.results
        .filter((r) => !r.ok)
        .map((r) => ({
            id: r.id,
            name: names.get(r.id) || `User #${r.id}`,
            message: r.error || "Not changed.",
        }));
    const succeeded = result.succeeded ?? result.results.filter((r) => r.ok).length;
    const failed = result.failed ?? failures.length;
    let headline: string;
    let tone: BulkSummary["tone"];
    if (failed === 0) {
        headline = `${verb} ${people(succeeded)}.`;
        tone = "ok";
    } else if (succeeded === 0) {
        headline = `No users were changed: ${failed === 1 ? "1 failure" : `${failed} failures`}.`;
        tone = "danger";
    } else {
        headline = `${verb} ${people(succeeded)}; ${failed} could not be changed.`;
        tone = "warn";
    }
    return { succeeded, failed, failures, headline, tone };
}

// ---- Departments -----------------------------------------------------------------------

/** Who may be chosen as a department's manager: active members with the MANAGER or ADMIN role. */
export function eligibleManagers<T extends Pick<UserDto, "status" | "roles">>(members: readonly T[]): T[] {
    return members.filter((m) => (m.status ?? "Active") === "Active" && (hasRole(m, "MANAGER") || hasRole(m, "ADMIN")));
}

export interface DepartmentBudget {
    budget: number;
    spent: number;
    committed: number;
}

/** Adds up the budget lines of each department (lines without a department are skipped). */
export function budgetsByDepartment(lines: readonly BudgetLineLite[]): Map<number, DepartmentBudget> {
    const result = new Map<number, DepartmentBudget>();
    for (const line of lines) {
        if (line.departmentId == null) continue;
        const sum = result.get(line.departmentId) ?? { budget: 0, spent: 0, committed: 0 };
        sum.budget += Number(line.amount) || 0;
        sum.spent += Number(line.spent) || 0;
        sum.committed += Number(line.committed) || 0;
        result.set(line.departmentId, sum);
    }
    return result;
}

/** Spent as a whole percentage of the budget, or null when there is no budget to compare with. */
export function utilisation(spent: number, budget: number): number | null {
    if (!(budget > 0)) return null;
    return Math.round((spent / budget) * 100);
}

/** The tone of a utilisation figure: over 100% is over budget, from 85% it is close. */
export function utilisationTone(percent: number | null): "ok" | "warn" | "danger" | "neutral" {
    if (percent == null) return "neutral";
    if (percent > 100) return "danger";
    if (percent >= 85) return "warn";
    return "ok";
}

/** "Q3 2026" */
export function quarterLabel(year: number, quarter: number | null | undefined): string {
    return quarter ? `Q${quarter} ${year}` : String(year);
}
