package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.RoleDto;
import com.msframework.backend.entity.Role;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.CurrentUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

@Tag(name = "Roles", description = "The roles, what they allow and how many users have them")
@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RoleController {

    /** What each built-in role is for, as shown on the Roles page. */
    private static final Map<String, String> DESCRIPTIONS = Map.of(
            SystemRoles.ADMIN, "Full access to every page and setting.",
            SystemRoles.MANAGER, "Runs their own department: edits it and its members and viewers, reads the audit log.",
            SystemRoles.MEMBER, "Reads the dashboard, people and departments.",
            SystemRoles.VIEWER, "Reads the dashboard and the documentation.");

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;

    @Operation(operationId = "listRoles", summary = "List roles with their permissions and member counts",
            description = "Built-in roles come first, from the most to the least privileged. Their permissions "
                    + "are defined in code and reset on every start-up.")
    @GetMapping
    @Transactional(readOnly = true)
    public List<RoleDto> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.ROLES_READ);

        Map<String, long[]> counts = new HashMap<>();
        for (Object[] row : userRepository.countMembersPerRole()) {
            counts.put((String) row[0], new long[]{((Number) row[1]).longValue(),
                    row[2] == null ? 0 : ((Number) row[2]).longValue()});
        }
        List<String> order = new ArrayList<>(SystemRoles.DEFINITIONS.keySet());

        return roleRepository.findAll().stream()
                .sorted(Comparator.comparingInt((Role r) -> order.contains(r.getName())
                                ? order.indexOf(r.getName()) : order.size())
                        .thenComparing(Role::getName))
                .map(role -> {
                    long[] count = counts.getOrDefault(role.getName(), new long[]{0, 0});
                    boolean builtIn = SystemRoles.DEFINITIONS.containsKey(role.getName());
                    return new RoleDto(
                            role.getName(),
                            DESCRIPTIONS.getOrDefault(role.getName(), "A custom role."),
                            builtIn,
                            new TreeSet<>(builtIn ? SystemRoles.DEFINITIONS.get(role.getName()) : role.getPermissions()),
                            count[0],
                            count[1]);
                })
                .toList();
    }
}
