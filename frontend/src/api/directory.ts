/**
 * Directory sync (Authentik): types mirroring backend dto/DirectoryDtos.java, and the calls.
 * Keep them in sync with the backend; api/openapi.json is the contract.
 */
import { del, get, post, put } from "./client";

/** How Authentik groups become MSFramework users. "admin-*" matches every group starting with "admin-". */
export interface DirectoryMapping {
    staffGroups: string[];
    adminGroups: string[];
    managerGroups: string[];
    memberGroups: string[];
    /** Group name to department name; "" means the group gives no department. */
    departments: Record<string, string>;
    ignoredUsernames: string[];
}

export interface DirectoryMappingState {
    mapping: DirectoryMapping;
    /** False while the built-in defaults are used. */
    custom: boolean;
    updatedAt: string | null;
}

export interface DirectorySyncCounts {
    created: number;
    updated: number;
    linked: number;
    deactivated: number;
    skipped: number;
    unchanged: number;
}

export interface DirectoryStatus {
    configured: boolean;
    provider: string;
    host: string | null;
    tokenSource: "env" | "file" | null;
    linkedUsers: number;
    lastSyncAt: string | null;
    lastSyncBy: string | null;
    lastSyncCounts: DirectorySyncCounts | null;
}

export type DirectoryAction = "create" | "link" | "update" | "deactivate" | "skip" | "unchanged";

export type DirectoryField = "name" | "email" | "username" | "status" | "role" | "department" | "manages";

export interface DirectoryFieldChange {
    field: DirectoryField;
    from: string | null;
    to: string | null;
}

export interface DirectoryChange {
    action: DirectoryAction;
    externalId: string | null;
    username: string | null;
    name: string | null;
    email: string | null;
    userId: number | null;
    role: string | null;
    department: string | null;
    fields: DirectoryFieldChange[];
    reason: string | null;
    notes: string[];
    /** null in a preview; after a sync, true when the change was written. */
    applied: boolean | null;
}

export interface DirectorySyncResult {
    dryRun: boolean;
    at: string;
    host: string | null;
    directoryUsers: number;
    counts: DirectorySyncCounts;
    changes: DirectoryChange[];
    sessionsRevoked: number;
}

export const getDirectoryStatus = () => get<DirectoryStatus>("/api/directory/status");
export const previewDirectorySync = () => post<DirectorySyncResult>("/api/directory/sync/preview");
export const runDirectorySync = () => post<DirectorySyncResult>("/api/directory/sync");
export const getDirectoryMapping = () => get<DirectoryMappingState>("/api/directory/mapping");
export const saveDirectoryMapping = (mapping: DirectoryMapping) =>
    put<DirectoryMappingState>("/api/directory/mapping", mapping);
export const resetDirectoryMapping = () => del<DirectoryMappingState>("/api/directory/mapping");
