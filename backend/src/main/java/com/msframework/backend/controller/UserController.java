package com.msframework.backend.controller;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.config.Permission;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final RoleRepository roleRepository;

    @GetMapping
    public ResponseEntity<?> getAllUsers(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        User currentUser = userRepository.findByEmail(principal.getName())
                .orElse(null);

        if (currentUser == null || !currentUser.hasPermission(Permission.USER_READ)) {
            return ResponseEntity.status(403).body("Missing permission: USER_READ");
        }

        List<User> users = userRepository.findAll()
                .stream()
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .toList();

        return ResponseEntity.ok(users);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Principal principal
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).body("Not authenticated");
        }

        User currentUser = userRepository.findByEmail(principal.getName())
                .orElse(null);

        if (currentUser == null || !currentUser.hasPermission(Permission.USER_UPDATE)) {
            return ResponseEntity.status(403).body("Missing permission: USER_UPDATE");
        }
        return userRepository.findById(id)
                .map(user -> {
                    boolean currentUserIsAdmin = currentUser.hasRole("ADMIN");
                    boolean currentUserIsManager = currentUser.hasRole("MANAGER");

                    boolean targetUserIsAdmin = user.hasRole("ADMIN");
                    boolean targetUserIsManager = user.hasRole("MANAGER");

                    if (!currentUserIsAdmin && !currentUserIsManager) {
                        return ResponseEntity.status(403).body("Only admins and managers can edit users");
                    }

                    if (currentUserIsManager) {
                        if (targetUserIsAdmin || targetUserIsManager) {
                            return ResponseEntity.status(403).body("Managers cannot edit admins or other managers");
                        }

                        if (currentUser.getDepartment() == null || user.getDepartment() == null) {
                            return ResponseEntity.status(403).body("Managers can only edit users in their own department");
                        }

                        if (!currentUser.getDepartment().getId().equals(user.getDepartment().getId())) {
                            return ResponseEntity.status(403).body("Managers can only edit users in their own department");
                        }
                    }
                    String fullName = body.getOrDefault("fullName", "").trim();
                    String email = body.getOrDefault("email", "").trim();
                    String roleName = body.getOrDefault("role", "MEMBER").trim();
                    String status = body.getOrDefault("status", "Active").trim();
                    String departmentIdRaw = body.get("departmentId");

                    if (currentUserIsManager && ("ADMIN".equals(roleName) || "MANAGER".equals(roleName))) {
                        return ResponseEntity.status(403).body("Managers cannot assign ADMIN or MANAGER roles");
                    }

                    if (currentUserIsManager) {
                        String currentManagerDepartmentId = String.valueOf(currentUser.getDepartment().getId());

                        if (departmentIdRaw == null || departmentIdRaw.isBlank()) {
                            return ResponseEntity.status(403).body("Managers cannot remove users from their department");
                        }

                        if (!departmentIdRaw.equals(currentManagerDepartmentId)) {
                            return ResponseEntity.status(403).body("Managers cannot move users to another department");
                        }
                    }

                    if (fullName.isBlank()) {
                        return ResponseEntity.badRequest().body("Full name is required");
                    }

                    if (!email.contains("@")) {
                        return ResponseEntity.badRequest().body("Invalid email");
                    }

                    boolean emailTaken = userRepository.existsByEmail(email)
                            && !email.equalsIgnoreCase(user.getEmail());

                    if (emailTaken) {
                        return ResponseEntity.badRequest().body("Email already in use");
                    }

                    Role newRole = roleRepository.findByName(roleName)
                            .orElseThrow(() -> new RuntimeException("Role not found: " + roleName));

                    user.setFullName(fullName);
                    user.setEmail(email);
                    user.setStatus(status);
                    user.setRoles(new HashSet<>(Set.of(newRole)));

                    if (departmentIdRaw == null || departmentIdRaw.isBlank()) {
                        user.setDepartment(null);
                    } else {
                        Long departmentId = Long.parseLong(departmentIdRaw);

                        Department department = departmentRepository.findById(departmentId)
                                .orElseThrow(() -> new RuntimeException("Department not found"));

                        user.setDepartment(department);
                    }

                    User saved = userRepository.save(user);

                    return ResponseEntity.ok(saved);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}