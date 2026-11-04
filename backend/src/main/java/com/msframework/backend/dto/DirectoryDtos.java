package com.msframework.backend.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Requests and responses of the directory sync API (Authentik). */
public final class DirectoryDtos {

    private DirectoryDtos() {
    }

    @Schema(name = "DirectoryMapping", description = """
            How Authentik groups become MSFramework users. Group names match without regard to case, and \
            an entry ending in * matches every group that starts with the rest ("admin-*").""")
    public record DirectoryMapping(
            @Schema(description = "Only members of at least one of these groups are imported")
            List<String> staffGroups,
            @Schema(description = "Members get the ADMIN role (the highest matching role wins)")
            List<String> adminGroups,
            @Schema(description = "Members get the MANAGER role")
            List<String> managerGroups,
            @Schema(description = "Members get the MEMBER role. Staff in none of the role groups also get MEMBER")
            List<String> memberGroups,
            @Schema(description = "Group name to department name, in order: the first group with a department "
                    + "wins. An empty value means the group gives no department. Staff in none of these groups "
                    + "keep their current department")
            Map<String, String> departments,
            @Schema(description = "Authentik user names that are never imported (system accounts)")
            List<String> ignoredUsernames
    ) {}

    @Schema(name = "DirectoryMappingState")
    public record DirectoryMappingDto(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DirectoryMapping mapping,
            @Schema(description = "False while the built-in defaults are used") boolean custom,
            @Schema(description = "When an admin last saved it; null for the defaults") OffsetDateTime updatedAt
    ) {}

    @Schema(name = "DirectorySyncCounts", description = "How many people each kind of change applies to")
    public record DirectorySyncCounts(
            int created,
            int updated,
            int linked,
            int deactivated,
            int skipped,
            int unchanged
    ) {}

    @Schema(name = "DirectoryStatus")
    public record DirectoryStatusDto(
            @Schema(description = "True when AUTHENTIK_URL is set") boolean configured,
            @Schema(example = "authentik") String provider,
            @Schema(description = "Host name of AUTHENTIK_URL, or null") String host,
            @Schema(description = "Where the token comes from: env (AUTHENTIK_TOKEN), file (AUTHENTIK_TOKEN_FILE) "
                    + "or null. The token itself is never sent", allowableValues = {"env", "file"})
            String tokenSource,
            @Schema(description = "Users currently linked to the directory") long linkedUsers,
            @Schema(description = "When the last applied sync ran, or null") OffsetDateTime lastSyncAt,
            @Schema(description = "Who ran it") String lastSyncBy,
            @Schema(description = "What it changed") DirectorySyncCounts lastSyncCounts
    ) {}

    @Schema(name = "DirectoryFieldChange", description = "One field of a user that the sync changes")
    public record DirectoryFieldChange(
            @Schema(allowableValues = {"name", "email", "username", "status", "role", "department", "manages"})
            String field,
            String from,
            String to
    ) {}

    @Schema(name = "DirectoryChange", description = "What the sync does, or did, for one person")
    public record DirectoryChange(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                    allowableValues = {"create", "link", "update", "deactivate", "skip", "unchanged"})
            String action,
            @Schema(description = "The Authentik user id (pk), or null for a linked user no longer in Authentik")
            String externalId,
            String username,
            String name,
            String email,
            @Schema(description = "The MSFramework user, or null when there is none (yet)") Long userId,
            @Schema(description = "The role after the sync") String role,
            @Schema(description = "The department after the sync") String department,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DirectoryFieldChange> fields,
            @Schema(description = "Why the person is skipped or deactivated") String reason,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Warnings, e.g. a missing department")
            List<String> notes,
            @Schema(description = "Null in a preview; after a sync, true when the change was written")
            Boolean applied
    ) {}

    @Schema(name = "DirectorySyncResult")
    public record DirectorySyncResult(
            @Schema(description = "True for a preview, which changes nothing") boolean dryRun,
            OffsetDateTime at,
            String host,
            @Schema(description = "People returned by Authentik") int directoryUsers,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DirectorySyncCounts counts,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DirectoryChange> changes,
            @Schema(description = "Sessions ended because their user was deactivated (0 in a preview)")
            int sessionsRevoked
    ) {}
}
