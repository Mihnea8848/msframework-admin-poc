/**
 * Types for the people APIs: paged user search, bulk changes, user and department details,
 * reset links, roles and access requests. The activity feeds use AuditPage from api/security.ts.
 * They mirror the records in backend/src/main/java/com/msframework/backend/dto/ (see
 * api/openapi.json). Keep them in sync.
 */
import type { IsoDateTime, Permission, UserDto, UserStatus } from "./types";

/** GET /api/users/search: one page of users. `page` is zero-based. */
export interface UserPage {
    items: UserDto[];
    page: number;
    size: number;
    /** Users matching the filters, on all pages. */
    total: number;
    totalPages: number;
}

/** The `sort` values /api/users/search accepts; a leading "-" sorts descending. */
export type UserSortField = "name" | "email" | "department" | "status" | "createdAt" | "lastLoginAt";
export type UserSort = UserSortField | `-${UserSortField}`;

export type BulkAction = "ACTIVATE" | "DEACTIVATE" | "SET_ROLE" | "SET_DEPARTMENT";

/** POST /api/users/bulk */
export interface BulkUserRequest {
    action: BulkAction;
    /** 1 to 200 user ids. */
    ids: number[];
    /** Required for SET_ROLE. */
    role?: string;
    /** For SET_DEPARTMENT; null removes the users from their department. */
    departmentId?: number | null;
}

export interface BulkUserResultItem {
    id: number;
    ok: boolean;
    /** Why this user was not changed, written for the end user; null when ok. */
    error: string | null;
    /** The user after the change; null when not ok. */
    user: UserDto | null;
}

export interface BulkUserResult {
    succeeded: number;
    failed: number;
    results: BulkUserResultItem[];
}

/** GET /api/users/{id} */
export interface UserDetailsDto {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
    title: string | null;
    status: UserStatus | null;
    roles: string[];
    permissions: Permission[];
    departmentId: number | null;
    departmentName: string | null;
    departmentColor: string | null;
    departmentManagerId: number | null;
    departmentManagerName: string | null;
    /** The department this user is the head of, or null. */
    managerOf: number | null;
    managerOfName: string | null;
    createdAt: IsoDateTime | null;
    lastLoginAt: IsoDateTime | null;
    passwordChangedAt: IsoDateTime | null;
    /** Whether the caller may edit this user (USER_UPDATE and the manager scope rules). */
    canEdit: boolean;
}

/** POST /api/users/{id}/password-reset */
export interface PasswordResetLinkDto {
    link: string;
    expiresAt: IsoDateTime;
}

/** GET /api/departments/{id} */
export interface DepartmentDetailsDto {
    id: number;
    name: string;
    color: string | null;
    managerId: number | null;
    managerName: string | null;
    memberCount: number;
    activeMemberCount: number;
    members: UserDto[];
}

/** GET /api/roles */
export interface RoleDto {
    name: string;
    description: string | null;
    builtIn: boolean;
    memberCount: number;
    activeMemberCount: number;
    permissions: Permission[];
}

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** GET /api/access-requests */
export interface AccessRequestDto {
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    /** The department the person asked to join. */
    departmentId: number | null;
    departmentName: string | null;
    status: AccessRequestStatus;
    createdAt: IsoDateTime;
    decidedAt: IsoDateTime | null;
    /** Email of the administrator who decided. */
    decidedBy: string | null;
    /** The reason given when the request was rejected. */
    note: string | null;
    /** The account created on approval. */
    userId: number | null;
}

// ---- Figures read by the department cards and detail ---------------------------------
// Only the fields the people pages read. The business pages have the full types.

/** GoalAttainment, inside DepartmentPerformance. */
export interface GoalAttainmentLite {
    goalId: number;
    name: string;
    unit: string | null;
    weight: number;
    /** Progress from baseline to target in percent (0 to 120); null without check-ins. */
    attainment: number | null;
}

export interface PerformanceTrendPointLite {
    /** "2026-06" */
    month: string;
    /** Score at the end of the month; null when no goal had data. */
    score: number | null;
}

export interface DepartmentPerformanceLite {
    departmentId: number;
    departmentName: string;
    goalCount: number;
    goalsWithData: number;
    /** Weighted average attainment of the goals that have check-ins; null when none. */
    score: number | null;
    goals: GoalAttainmentLite[];
    /** Six monthly scores, oldest first. */
    trend: PerformanceTrendPointLite[];
}

/** GET /api/performance (current quarter when no year and quarter are given). */
export interface PerformanceOverviewLite {
    year: number;
    quarter: number;
    departments: DepartmentPerformanceLite[];
}

export interface BudgetLineLite {
    departmentId: number | null;
    departmentName: string | null;
    categoryId: number | null;
    categoryName: string | null;
    amount: number;
    /** Approved and paid expenses in the quarter. */
    spent: number;
    /** Submitted expenses in the quarter. */
    committed: number;
    remaining: number;
}

export interface MoneyTotalsLite {
    budget: number;
    spent: number;
    committed: number;
    remaining: number;
}

/** GET /api/budgets (current quarter when no year and quarter are given). */
export interface BudgetSummaryLite {
    year: number;
    quarter: number | null;
    currency: string;
    lines: BudgetLineLite[];
    totals: MoneyTotalsLite;
}
