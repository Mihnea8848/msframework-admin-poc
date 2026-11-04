package com.msframework.backend.service;

import com.msframework.backend.dto.DirectoryDtos.DirectoryMapping;
import com.msframework.backend.dto.DirectoryDtos.DirectoryMappingDto;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.OrgSettingRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * The Authentik group mapping, stored as one JSON organisation setting
 * ({@value #MAPPING_KEY}). A missing row means {@link #DEFAULTS}. Group names are not personal
 * data, so the defaults may live in the code.
 */
@Service
@RequiredArgsConstructor
public class DirectoryMappingService {

    public static final String MAPPING_KEY = "directory.authentik.mapping";

    private static final int MAX_ENTRIES = 200;
    private static final int MAX_NAME = 150;

    private static final Logger log = LoggerFactory.getLogger(DirectoryMappingService.class);

    public static final DirectoryMapping DEFAULTS = new DirectoryMapping(
            List.of("director", "authentik Admins", "administrator", "admin-*", "employee"),
            List.of("director", "authentik Admins", "administrator"),
            List.of("admin-*"),
            List.of("employee"),
            defaultDepartments(),
            List.of("akadmin"));

    private static Map<String, String> defaultDepartments() {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("admin-development", "Development");
        map.put("admin-engineering", "Engineering & Innovation");
        map.put("admin-ethics", "Ethics & Regulations");
        map.put("admin-externalaffairs", "External Affairs");
        map.put("admin-humanresources", "Human Resources");
        map.put("admin-qualitycontrol", "Quality Control");
        map.put("admin-hoa", "Administration");
        map.put("admin-support", "");
        return java.util.Collections.unmodifiableMap(map);
    }

    private final OrgSettingRepository settings;
    private final DepartmentRepository departmentRepository;
    private final AuditService auditService;
    private final JsonMapper jsonMapper;

    /** The mapping the sync uses: the saved one, or the defaults. */
    @Transactional(readOnly = true)
    public DirectoryMapping current() {
        return state().mapping();
    }

    @Transactional(readOnly = true)
    public DirectoryMappingDto state() {
        Optional<OrgSetting> row = settings.findById(MAPPING_KEY).filter(s -> s.getValue() != null && !s.getValue().isBlank());
        if (row.isEmpty()) return new DirectoryMappingDto(DEFAULTS, false, null);
        try {
            DirectoryMapping saved = normalize(jsonMapper.readValue(row.get().getValue(), DirectoryMapping.class));
            return new DirectoryMappingDto(saved, true, Times.toOffset(row.get().getUpdatedAt()));
        } catch (JacksonException | ApiException e) {
            log.warn("[DIRECTORY] The saved mapping ({}) is not valid; using the defaults", MAPPING_KEY);
            return new DirectoryMappingDto(DEFAULTS, false, null);
        }
    }

    @Transactional
    public DirectoryMappingDto save(DirectoryMapping requested, User actor) {
        DirectoryMapping mapping = normalize(requested);
        for (String department : mapping.departments().values()) {
            if (!department.isEmpty() && departmentRepository.findByNameIgnoreCase(department).isEmpty()) {
                throw ApiException.badRequest("There is no department called \"" + department + "\".");
            }
        }
        OrgSetting row = settings.findById(MAPPING_KEY).orElseGet(() -> OrgSetting.builder().key(MAPPING_KEY).build());
        row.setValue(jsonMapper.writeValueAsString(mapping));
        row.setUpdatedAt(LocalDateTime.now());
        settings.save(row);
        auditService.log("org_settings_changed", actor.getEmail(), "Authentik group mapping changed");
        return state();
    }

    @Transactional
    public DirectoryMappingDto reset(User actor) {
        if (settings.existsById(MAPPING_KEY)) {
            settings.deleteById(MAPPING_KEY);
            auditService.log("org_settings_changed", actor.getEmail(), "Authentik group mapping reset to the defaults");
        }
        return state();
    }

    /** Trims every name, drops blanks and duplicates, and checks the sizes. */
    static DirectoryMapping normalize(DirectoryMapping mapping) {
        if (mapping == null) throw ApiException.badRequest("The mapping is required");
        List<String> staff = names(mapping.staffGroups(), "staffGroups");
        if (staff.isEmpty()) throw ApiException.badRequest("staffGroups needs at least one group");
        Map<String, String> departments = new LinkedHashMap<>();
        if (mapping.departments() != null) {
            if (mapping.departments().size() > MAX_ENTRIES) throw ApiException.badRequest("departments has too many entries");
            mapping.departments().forEach((group, department) -> {
                String g = clean(group);
                if (g.isEmpty()) return;
                departments.putIfAbsent(g, clean(department));
            });
        }
        return new DirectoryMapping(staff,
                names(mapping.adminGroups(), "adminGroups"),
                names(mapping.managerGroups(), "managerGroups"),
                names(mapping.memberGroups(), "memberGroups"),
                departments,
                names(mapping.ignoredUsernames(), "ignoredUsernames"));
    }

    private static List<String> names(List<String> raw, String field) {
        if (raw == null) return List.of();
        if (raw.size() > MAX_ENTRIES) throw ApiException.badRequest(field + " has too many entries");
        List<String> out = new ArrayList<>();
        for (String value : raw) {
            String name = clean(value);
            if (name.isEmpty() || out.stream().anyMatch(name::equalsIgnoreCase)) continue;
            if (name.equals("*")) throw ApiException.badRequest(field + ": \"*\" alone would match every group");
            out.add(name);
        }
        return List.copyOf(out);
    }

    private static String clean(String value) {
        String v = value == null ? "" : value.trim();
        if (v.length() > MAX_NAME) throw ApiException.badRequest("Group and department names must be at most " + MAX_NAME + " characters");
        return v;
    }

    // ------------------------------------------------------------------ matching

    /** True when {@code group} matches one of the patterns ("name", or "prefix*"), ignoring case. */
    public static boolean matchesAny(List<String> patterns, String group) {
        return patterns.stream().anyMatch(matcher(group));
    }

    private static Predicate<String> matcher(String group) {
        String g = group.toLowerCase(Locale.ROOT);
        return pattern -> {
            String p = pattern.toLowerCase(Locale.ROOT);
            return p.endsWith("*") ? g.startsWith(p.substring(0, p.length() - 1)) : g.equals(p);
        };
    }
}
