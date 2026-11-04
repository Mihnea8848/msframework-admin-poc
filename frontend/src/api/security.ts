/**
 * Types and calls for sessions, organisation settings, registration status and the personal
 * activity feed. They mirror backend dto/SessionDto, OrgSettingsDto, OrgSettingsRequest,
 * RegistrationStatusDto and AuditPage; keep them in sync when those records change.
 */
import { del, get, put } from "./client";
import type { RequestOptions } from "./client";
import type { AuditEventDto, IsoDateTime } from "./types";

/** dto/SessionDto: one signed-in session. `id` is a hash, never the real session id. */
export interface SessionDto {
    id: string;
    createdAt: IsoDateTime;
    lastActiveAt: IsoDateTime;
    expiresAt: IsoDateTime;
    ipAddress: string | null;
    userAgent: string | null;
    /** True for the session that made the request. */
    current: boolean;
}

/** dto/OrgSettingsDto */
export interface OrgSettingsDto {
    companyName: string;
    registrationEnabled: boolean;
    passwordMinLength: number;
    /** Read only: set by the server (SESSION_TIMEOUT). */
    sessionTimeoutMinutes: number;
    defaultTimezone: string | null;
}

/** dto/OrgSettingsRequest: fields left out keep their value. */
export interface OrgSettingsRequest {
    companyName?: string;
    registrationEnabled?: boolean;
    passwordMinLength?: number;
    defaultTimezone?: string;
}

/** dto/RegistrationStatusDto, from the public GET /api/auth/registration. */
export interface RegistrationStatusDto {
    open: boolean;
    passwordMinLength: number;
}

/** dto/AuditPage: one page of an activity feed, newest first. */
export interface AuditPage {
    items: (AuditEventDto & { subjectUserId?: number | null; subjectDepartmentId?: number | null })[];
    /** Pass back as `cursor` for the next (older) page; null on the last page. */
    nextCursor: string | null;
}

export const fetchMySessions = (options?: RequestOptions) => get<SessionDto[]>("/api/sessions/me", options);
export const revokeMySession = (id: string) => del<null>(`/api/sessions/me/${encodeURIComponent(id)}`);
export const revokeMyOtherSessions = () => del<null>("/api/sessions/me/others");
export const fetchUserSessions = (userId: number) => get<SessionDto[]>(`/api/sessions?userId=${userId}`);
export const revokeUserSessions = (userId: number) => del<null>(`/api/sessions/user/${userId}`);

export const fetchOrgSettings = () => get<OrgSettingsDto>("/api/org/settings");
export const saveOrgSettings = (body: OrgSettingsRequest) => put<OrgSettingsDto>("/api/org/settings", body);

export const fetchRegistrationStatus = () =>
    get<RegistrationStatusDto>("/api/auth/registration", { authRedirect: false });

/** The caller's own activity (GET /api/audit/me), any signed-in user. */
export function fetchMyActivity(params: { cursor?: string | null; limit?: number } = {}, options?: RequestOptions) {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    return get<AuditPage>(`/api/audit/me${qs ? `?${qs}` : ""}`, options);
}
