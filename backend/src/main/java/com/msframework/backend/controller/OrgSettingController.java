package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.SettingValueRequest;
import com.msframework.backend.dto.WorldClock;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.OrgSettingRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.security.Principal;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Organisation-wide settings. Only known keys are accepted, and each value is validated:
 * <ul>
 *   <li>{@code orgTimezone} – an IANA zone id such as "Europe/Bucharest"</li>
 *   <li>{@code worldClocks} – JSON array of {"label", "tz"} shown on the Timezones page</li>
 * </ul>
 */
@Tag(name = "Settings", description = "Organisation-wide settings")
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class OrgSettingController {

    public static final String ORG_TIMEZONE = "orgTimezone";
    public static final String WORLD_CLOCKS = "worldClocks";
    private static final Set<String> KNOWN_KEYS = Set.of(ORG_TIMEZONE, WORLD_CLOCKS);
    private static final int MAX_CLOCKS = 24;

    private final OrgSettingRepository orgSettingRepository;
    private final CurrentUserService currentUserService;
    private final AuditService auditService;
    private final JsonMapper jsonMapper;

    /** 200 with the setting, or 204 when it has never been saved. */
    @Operation(operationId = "getSetting", summary = "Read an organisation setting")
    @ApiResponse(responseCode = "200", description = "The saved setting")
    @ApiResponse(responseCode = "204", description = "The setting has never been saved", content = @Content)
    @GetMapping("/{key}")
    public ResponseEntity<OrgSetting> get(
            @Parameter(schema = @Schema(allowableValues = {ORG_TIMEZONE, WORLD_CLOCKS})) @PathVariable String key,
            Principal principal) {
        currentUserService.require(principal);
        requireKnown(key);
        return orgSettingRepository.findById(key)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(operationId = "saveSetting", summary = "Save an organisation setting")
    @PutMapping("/{key}")
    public OrgSetting put(
            @Parameter(schema = @Schema(allowableValues = {ORG_TIMEZONE, WORLD_CLOCKS})) @PathVariable String key,
            @RequestBody SettingValueRequest body,
            Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.TIMEZONES_UPDATE);
        requireKnown(key);
        String value = switch (key) {
            case ORG_TIMEZONE -> validateZone(body.value());
            case WORLD_CLOCKS -> normalizeClocks(body.value());
            default -> throw ApiException.notFound("Unknown setting: " + key);
        };

        OrgSetting setting = orgSettingRepository.findById(key).orElse(OrgSetting.builder().key(key).build());
        setting.setValue(value);
        setting.setUpdatedAt(LocalDateTime.now());
        OrgSetting saved = orgSettingRepository.save(setting);

        auditService.log("setting_changed", actor.getEmail(), ORG_TIMEZONE.equals(key)
                ? "Organisation timezone set to " + value
                : "World clocks updated");
        return saved;
    }

    private static void requireKnown(String key) {
        if (!KNOWN_KEYS.contains(key)) {
            throw ApiException.notFound("Unknown setting: " + key);
        }
    }

    private static String validateZone(String raw) {
        String zone = raw == null ? "" : raw.trim();
        if (zone.isEmpty()) throw ApiException.badRequest("Timezone is required");
        try {
            return ZoneId.of(zone).getId();
        } catch (DateTimeException e) {
            throw ApiException.badRequest("Unknown timezone: " + zone);
        }
    }

    private String normalizeClocks(String raw) {
        if (raw == null || raw.isBlank()) throw ApiException.badRequest("Clock list is required");
        WorldClock[] clocks;
        try {
            clocks = jsonMapper.readValue(raw, WorldClock[].class);
        } catch (JacksonException e) {
            throw ApiException.badRequest("Clock list must be a JSON array of {label, tz}");
        }
        if (clocks == null) throw ApiException.badRequest("Clock list must be a JSON array of {label, tz}");
        if (clocks.length > MAX_CLOCKS) throw ApiException.badRequest("At most " + MAX_CLOCKS + " clocks are allowed");

        List<WorldClock> normalized = new ArrayList<>();
        for (WorldClock clock : clocks) {
            if (clock == null) continue;
            String label = clock.label() == null ? "" : clock.label().trim();
            if (label.isEmpty() || label.length() > 40) {
                throw ApiException.badRequest("Each clock needs a label of 1–40 characters");
            }
            normalized.add(new WorldClock(label, validateZone(clock.tz())));
        }
        return jsonMapper.writeValueAsString(normalized);
    }
}
