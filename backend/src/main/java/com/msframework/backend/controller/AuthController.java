package com.msframework.backend.controller;

import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.dto.UserInfoResponse;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.entity.Role;

import java.util.stream.Collectors;

import java.util.HashSet;
import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;

    private final RoleRepository roleRepository;

    private final Map<String, PasswordResetData> passwordResetTokens = new ConcurrentHashMap<>();

    private record PasswordResetData(String email, LocalDateTime expiresAt) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request,
                                   HttpServletRequest httpRequest,
                                   HttpServletResponse httpResponse) {
        String email = request.get("email");

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.get("password"))
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);

        SecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();
        contextRepository.saveContext(context, httpRequest, httpResponse);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        auditService.log("user_login", email, user.getFullName() + " signed in");

        return ResponseEntity.ok(user);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Principal principal) {
        if (principal == null) {
            return ResponseEntity.ok().body(null);
        }

        return userRepository.findByEmail(principal.getName())
                .map(user -> ResponseEntity.ok().body(
                        new UserInfoResponse(
                                user.getId(),
                                user.getFullName(),
                                user.getEmail(),
                                user.getStatus(),
                                user.getDepartment() != null ? user.getDepartment().getId() : null,
                                user.getDepartment() != null ? user.getDepartment().getName() : null,
                                user.getRoles()
                                        .stream()
                                        .map(Role::getName)
                                        .collect(Collectors.toSet()),
                                user.getAllPermissions()
                        )
                ))
                .orElseGet(() -> ResponseEntity.ok().body(null));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        Department dept = departmentRepository.findById(request.departmentId()).orElse(null);
        Role memberRole = roleRepository.findByName("MEMBER")
                .orElseThrow(() -> new RuntimeException("MEMBER role not found"));

        User user = User.builder()
                .fullName(request.fullName())
                .phone(request.phone())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .status("Active")
                .department(dept)
                .roles(new HashSet<>(Set.of(memberRole)))
                .build();
        User saved = userRepository.save(user);
        auditService.log("user_created", "system", saved.getFullName() + " registered");
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, Principal principal) {
        if (principal != null) {
            auditService.log("user_logout", principal.getName(), principal.getName() + " signed out");
        }
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/email")
    public ResponseEntity<?> changeEmail(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String newEmail = body.getOrDefault("email", "").trim();
        if (!newEmail.contains("@")) return ResponseEntity.badRequest().body("Invalid email");
        if (userRepository.existsByEmail(newEmail)) return ResponseEntity.badRequest().body("Email already in use");

        return userRepository.findByEmail(principal.getName()).map(user -> {
            String oldEmail = user.getEmail();
            user.setEmail(newEmail);
            userRepository.save(user);
            auditService.log("email_changed", oldEmail, oldEmail + " changed email to " + newEmail);
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String currentPassword = body.getOrDefault("currentPassword", "");
        String newPassword = body.getOrDefault("newPassword", "");
        if (newPassword.length() < 8) return ResponseEntity.badRequest().body("Password too short");

        return userRepository.findByEmail(principal.getName()).map(user -> {
            if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
                return ResponseEntity.badRequest().body("Current password is incorrect");
            }
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);
            auditService.log("password_changed", user.getEmail(), user.getEmail() + " changed password");
            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim();

        if (email.isBlank()) {
            return ResponseEntity.badRequest().body("Email is required");
        }

        userRepository.findByEmail(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();

            passwordResetTokens.put(
                    token,
                    new PasswordResetData(email, LocalDateTime.now().plusMinutes(30))
            );

            String resetLink = "http://localhost:5173/reset-password?token=" + token;

            // For now, print it in the backend console.
            // Later, send this by email.
            System.out.println("Password reset link for " + email + ": " + resetLink);

            auditService.log("password_reset_requested", email, email + " requested password reset");
        });

        // Always return OK, even if email does not exist.
        // This avoids revealing which emails are registered.
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.getOrDefault("token", "").trim();
        String newPassword = body.getOrDefault("newPassword", "");

        if (token.isBlank()) {
            return ResponseEntity.badRequest().body("Token is required");
        }

        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body("Password too short");
        }

        PasswordResetData resetData = passwordResetTokens.get(token);

        if (resetData == null) {
            return ResponseEntity.badRequest().body("Invalid reset token");
        }

        if (resetData.expiresAt().isBefore(LocalDateTime.now())) {
            passwordResetTokens.remove(token);
            return ResponseEntity.badRequest().body("Reset token expired");
        }

        return userRepository.findByEmail(resetData.email()).map(user -> {
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepository.save(user);

            passwordResetTokens.remove(token);

            auditService.log(
                    "password_reset_completed",
                    user.getEmail(),
                    user.getEmail() + " reset password"
            );

            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.notFound().build());
    }
}
