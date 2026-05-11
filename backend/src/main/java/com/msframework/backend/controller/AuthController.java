package com.msframework.backend.controller;

import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
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
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;

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
        if (principal == null) return ResponseEntity.ok().body(null);
        return userRepository.findByEmail(principal.getName())
                .map(user -> ResponseEntity.ok().body(user))
                .orElseGet(() -> ResponseEntity.ok().body(null));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            return ResponseEntity.badRequest().body("Email already exists");
        }
        Department dept = departmentRepository.findById(request.departmentId()).orElse(null);
        User user = User.builder()
                .fullName(request.fullName())
                .phone(request.phone())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role("MEMBER")
                .status("Active")
                .department(dept)
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
}
