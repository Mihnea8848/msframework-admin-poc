package com.msframework.backend.service;

import com.msframework.backend.dto.OrgSettingsDto;
import com.msframework.backend.dto.OrgSettingsRequest;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.OrgSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * The typed organisation settings, stored as rows of {@code org_settings}. A missing row means
 * the default. {@code orgTimezone} is the same row the Timezones page edits.
 */
@Service
@RequiredArgsConstructor
public class OrgSettingsService {

    public static final String COMPANY_NAME = "companyName";
    public static final String REGISTRATION_ENABLED = "registrationEnabled";
    public static final String PASSWORD_MIN_LENGTH = "passwordMinLength";
    /** Shared with the Timezones page ({@code OrgSettingController.ORG_TIMEZONE}). */
    public static final String ORG_TIMEZONE = "orgTimezone";

    public static final String DEFAULT_COMPANY_NAME = "Multimedia Entertainment Hub";
    public static final int MIN_PASSWORD_LENGTH = 8;
    public static final int MAX_PASSWORD_LENGTH = 64;

    private final OrgSettingRepository repository;
    private final AuditService auditService;

    @Value("${server.servlet.session.timeout:30m}")
    private Duration sessionTimeout;

    @Transactional(readOnly = true)
    public OrgSettingsDto get() {
        return new OrgSettingsDto(
                companyName(),
                registrationEnabled(),
                passwordMinLength(),
                sessionTimeoutMinutes(),
                value(ORG_TIMEZONE).orElse(null));
    }

    public String companyName() {
        return value(COMPANY_NAME).orElse(DEFAULT_COMPANY_NAME);
    }

    public boolean registrationEnabled() {
        return value(REGISTRATION_ENABLED).map(Boolean::parseBoolean).orElse(true);
    }

    /** Guard for the public register endpoint: 403 while an administrator has closed registration. */
    public void requireRegistrationOpen() {
        if (!registrationEnabled()) {
            throw ApiException.forbidden("Registration is closed. Ask an administrator to create your account.");
        }
    }

    public int passwordMinLength() {
        return value(PASSWORD_MIN_LENGTH).map(v -> {
            try {
                return Math.clamp(Integer.parseInt(v), MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH);
            } catch (NumberFormatException e) {
                return MIN_PASSWORD_LENGTH;
            }
        }).orElse(MIN_PASSWORD_LENGTH);
    }

    public long sessionTimeoutMinutes() {
        return Math.max(1, sessionTimeout.toMinutes());
    }

    /** Applies the fields that are present; null fields keep their current value. */
    @Transactional
    public OrgSettingsDto update(OrgSettingsRequest request, User actor) {
        OrgSettingsDto before = get();
        List<String> changes = new ArrayList<>();

        if (request.companyName() != null) {
            String name = request.companyName().trim().replaceAll("\\s+", " ");
            if (name.isEmpty()) throw ApiException.badRequest("Company name is required");
            if (name.length() > 100) throw ApiException.badRequest("Company name must be at most 100 characters");
            save(COMPANY_NAME, name, before.companyName(), "company name", changes);
        }
        if (request.registrationEnabled() != null) {
            save(REGISTRATION_ENABLED, request.registrationEnabled().toString(),
                    Boolean.toString(before.registrationEnabled()), "registration", changes);
        }
        if (request.passwordMinLength() != null) {
            int length = request.passwordMinLength();
            if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
                throw ApiException.badRequest("Minimum password length must be between "
                        + MIN_PASSWORD_LENGTH + " and " + MAX_PASSWORD_LENGTH);
            }
            save(PASSWORD_MIN_LENGTH, Integer.toString(length),
                    Integer.toString(before.passwordMinLength()), "minimum password length", changes);
        }
        if (request.defaultTimezone() != null) {
            save(ORG_TIMEZONE, validateZone(request.defaultTimezone()), before.defaultTimezone(),
                    "default timezone", changes);
        }

        if (!changes.isEmpty()) {
            auditService.log("org_settings_changed", actor.getEmail(),
                    "Organisation settings changed: " + String.join(", ", changes));
        }
        return get();
    }

    private void save(String key, String value, String before, String label, List<String> changes) {
        if (Objects.equals(value, before)) return;
        OrgSetting setting = repository.findById(key).orElseGet(() -> OrgSetting.builder().key(key).build());
        setting.setValue(value);
        setting.setUpdatedAt(LocalDateTime.now());
        repository.save(setting);
        changes.add(label + " " + (before == null ? "none" : before) + " → " + value);
    }

    private Optional<String> value(String key) {
        return repository.findById(key).map(OrgSetting::getValue).filter(v -> !v.isBlank());
    }

    private static String validateZone(String raw) {
        String zone = raw.trim();
        if (zone.isEmpty()) throw ApiException.badRequest("Timezone is required");
        try {
            return ZoneId.of(zone).getId();
        } catch (DateTimeException e) {
            throw ApiException.badRequest("Unknown timezone: " + zone);
        }
    }
}
