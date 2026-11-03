package com.msframework.backend.service;

import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.ImportRequests;
import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Bulk import of rows parsed from CSV by the frontend. Every row is validated first; valid rows are
 * created, invalid ones are reported back with their row number and skipped.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    public static final int MAX_ROWS = 1000;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    @Transactional
    public ImportResult importDepartments(List<ImportRequests.DepartmentRow> rows, User actor) {
        requireRows(rows);
        List<ImportResult.RowError> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.DepartmentRow row = rows.get(i);
            int rowNumber = i + 1;
            try {
                String name = DepartmentRules.requireName(row == null ? null : row.name());
                String color = DepartmentRules.normalizeColor(row == null ? null : row.color());
                String key = name.toLowerCase(Locale.ROOT);
                if (!seen.add(key) || departmentRepository.findByNameIgnoreCase(name).isPresent()) {
                    throw ApiException.conflict("Department \"" + name + "\" already exists");
                }
                departmentRepository.save(Department.builder().name(name).color(color).build());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(rowNumber, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " department(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    /**
     * Imported users get a random password; they set their own through "Forgot password".
     */
    @Transactional
    public ImportResult importUsers(List<ImportRequests.UserRow> rows, User actor) {
        requireRows(rows);
        Map<String, Department> departmentsByName = new HashMap<>();
        departmentRepository.findAll().forEach(d -> departmentsByName.put(d.getName().toLowerCase(Locale.ROOT), d));

        List<ImportResult.RowError> errors = new ArrayList<>();
        Set<String> seenEmails = new HashSet<>();
        boolean actorIsAdmin = actor.hasRole(SystemRoles.ADMIN);
        int created = 0;

        for (int i = 0; i < rows.size(); i++) {
            ImportRequests.UserRow row = rows.get(i);
            int rowNumber = i + 1;
            try {
                if (row == null) throw ApiException.badRequest("Empty row");
                String fullName = UserService.requireFullName(row.fullName());
                String email = UserService.requireValidEmail(row.email());
                String phone = UserService.normalizePhone(row.phone(), false);
                Role role = userService.requireRole(row.role());
                String status = UserService.requireStatus(row.status());

                if (!actorIsAdmin && SystemRoles.isPrivileged(role.getName())) {
                    throw ApiException.forbidden("Only admins can assign the " + role.getName() + " role");
                }

                Department department = null;
                if (row.department() != null && !row.department().isBlank()) {
                    department = departmentsByName.get(row.department().trim().toLowerCase(Locale.ROOT));
                    if (department == null) {
                        throw ApiException.badRequest("Unknown department \"" + row.department().trim() + "\"");
                    }
                }

                if (!seenEmails.add(email) || userService.isEmailTaken(email, null)) {
                    throw ApiException.conflict("Email " + email + " is already in use");
                }

                userRepository.save(User.builder()
                        .fullName(fullName)
                        .email(email)
                        .phone(phone)
                        .password(passwordEncoder.encode(SecureTokens.random(24)))
                        .status(status)
                        .department(department)
                        .roles(new HashSet<>(Set.of(role)))
                        .build());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(rowNumber, e.getMessage()));
            }
        }

        auditService.log("import_completed", actor.getEmail(),
                "Imported " + created + " user(s) from CSV (" + errors.size() + " skipped)");
        return new ImportResult(created, errors.size(), errors);
    }

    private static void requireRows(List<?> rows) {
        if (rows == null || rows.isEmpty()) {
            throw ApiException.badRequest("The file contains no data rows");
        }
        if (rows.size() > MAX_ROWS) {
            throw ApiException.badRequest("Too many rows (maximum " + MAX_ROWS + " per import)");
        }
    }
}
