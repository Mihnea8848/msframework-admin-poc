/**
 * Hand-written types for the JSON the backend returns. They mirror the records in
 * backend/src/main/java/com/msframework/backend/dto/ (and the few entities that are still
 * serialized directly). Keep them in sync when a DTO changes.
 *
 * Java `OffsetDateTime` and `LocalDateTime` values arrive as ISO 8601 strings.
 */

/** ISO 8601 date-time string, for example "2026-11-03T10:15:30Z". */
export type IsoDateTime = string;

/** config/Permission.java */
export type Permission =
    | "DASHBOARD_READ"
    | "USER_READ"
    | "USER_CREATE"
    | "USER_UPDATE"
    | "USER_DELETE"
    | "DEPARTMENT_READ"
    | "DEPARTMENT_CREATE"
    | "DEPARTMENT_UPDATE"
    | "DEPARTMENT_DELETE"
    | "AUDIT_READ"
    | "APPEARANCE_READ"
    | "APPEARANCE_UPDATE"
    | "DATABASE_READ"
    | "DATABASE_UPDATE"
    | "DOCUMENTATION_READ"
    | "AUTH_SETTINGS_READ"
    | "AUTH_SETTINGS_UPDATE"
    | "SECURITY_READ"
    | "SECURITY_UPDATE"
    | "PAYMENTS_READ"
    | "PAYMENTS_UPDATE"
    | "IMPORT_DATA"
    | "EXPORT_DATA"
    | "CONNECTIONS_READ"
    | "CONNECTIONS_UPDATE"
    | "TIMEZONES_READ"
    | "TIMEZONES_UPDATE"
    | "WORKSPACE_READ"
    | "WORKSPACE_UPDATE"
    | "API_KEY_READ"
    | "API_KEY_CREATE"
    | "API_KEY_DELETE"
    // People: access requests and the roles overview
    | "ACCESS_REQUESTS_MANAGE"
    | "ROLES_READ"
    | "FINANCE_READ"
    | "FINANCE_MANAGE"
    | "EXPENSE_SUBMIT"
    | "EXPENSE_APPROVE"
    | "GOALS_READ"
    | "GOALS_MANAGE"
    | "REPORTS_READ"
    // Sessions and organisation settings (sessions-security)
    | "SESSIONS_MANAGE"
    | "ORG_SETTINGS_MANAGE";

/** The built-in roles in config/SystemRoles.java. */
export type RoleName = "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";

/** User.STATUS_ACTIVE / User.STATUS_INACTIVE. */
export type UserStatus = "Active" | "Inactive";

/** dto/CurrentUserDto: the signed-in user, from /api/auth/me and /api/auth/login. */
export interface CurrentUserDto {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
    status: UserStatus | null;
    departmentId: number | null;
    departmentName: string | null;
    /** Role names; the backend sends any role name, the built-in ones are listed in RoleName. */
    roles: string[];
    permissions: Permission[];
}

/** dto/UserDto: a user as shown in lists. */
export interface UserDto {
    id: number;
    fullName: string | null;
    email: string;
    phone: string | null;
    status: UserStatus | null;
    departmentId: number | null;
    departmentName: string | null;
    roles: string[];
    createdAt: IsoDateTime | null;
    /** Job title, e.g. "Senior Producer". */
    title?: string | null;
    /** Last successful sign-in; null if the user never signed in. */
    lastLoginAt?: IsoDateTime | null;
    /** The id of the department this user is the manager (head) of, or null. */
    managerOf?: number | null;
}

/** dto/DepartmentResponse */
export interface DepartmentResponse {
    id: number;
    name: string;
    color: string | null;
    memberCount: number;
    /** The head of the department; null when it has none. */
    managerId?: number | null;
    managerName?: string | null;
}

/** dto/AuditEventDto */
export interface AuditEventDto {
    id: number;
    eventType: string;
    actorEmail: string | null;
    description: string;
    createdAt: IsoDateTime;
    /** The user the event is about, if any. */
    subjectUserId?: number | null;
    /** The department the event is about, if any. */
    subjectDepartmentId?: number | null;
}

/** dto/ApiKeyDto. Null fields are omitted (`@JsonInclude(NON_NULL)`). */
export interface ApiKeyDto {
    id: number;
    name: string;
    maskedDisplay: string;
    createdBy?: string;
    createdAt?: IsoDateTime;
    lastUsed?: string;
    /** Only present in the response that creates the key. */
    secret?: string;
}

/** dto/ImportResult.RowError. `row` is 1-based and counts data rows only. */
export interface ImportRowError {
    row: number;
    message: string;
}

/** dto/ImportResult */
export interface ImportResult {
    created: number;
    skipped: number;
    errors: ImportRowError[];
}

/** dto/TableInfo.Column */
export interface TableColumn {
    name: string;
    type: string;
    nullable: boolean;
}

/** dto/TableInfo. `sizeBytes` is null when the database cannot report it. */
export interface TableInfo {
    name: string;
    rowCount: number;
    sizeBytes: number | null;
    columns: TableColumn[];
}

/** exception/ErrorResponse: the body of every error response. */
export interface ErrorResponse {
    status: number;
    error: string;
    message: string;
}

/** entity/ServiceConnection, serialized directly by ConnectionsController. */
export interface ServiceConnection {
    serviceId: string;
    connected: boolean;
    enabled: boolean;
    connectedAt: IsoDateTime | null;
}

/** entity/Webhook, serialized directly by WebhookController. */
export interface Webhook {
    id: number;
    url: string;
    /** Comma-separated event names; "*" means all events. */
    events: string | null;
    active: boolean;
    createdAt: IsoDateTime;
    /** "never" until the webhook fires. */
    lastTriggered: string | null;
}

/** entity/OrgSetting, serialized directly by OrgSettingController. */
export interface OrgSetting {
    key: string;
    value: string | null;
    updatedAt: IsoDateTime | null;
}
