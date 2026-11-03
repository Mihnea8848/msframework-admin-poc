package com.msframework.backend.controller;

import com.msframework.backend.dto.CurrentUserDto;
import com.msframework.backend.dto.LoginRequest;
import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.AuthSessionService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.PasswordResetService;
import com.msframework.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AuthSessionService authSessionService;
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordResetService passwordResetService;
    private final AuditService auditService;

    @PostMapping("/login")
    public CurrentUserDto login(@Valid @RequestBody LoginRequest request,
                                HttpServletRequest httpRequest,
                                HttpServletResponse httpResponse) {
        String email = UserService.normalizeEmail(request.email());

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        } catch (AuthenticationException e) {
            auditService.log("login_failed", email, "Failed sign-in attempt for " + email);
            throw ApiException.unauthorized("Invalid email or password");
        }

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));

        if (!user.isActive()) {
            auditService.log("login_blocked", user.getEmail(), "Sign-in blocked for inactive account " + user.getEmail());
            throw ApiException.forbidden("This account is inactive. Contact an administrator.");
        }

        authSessionService.establish(authentication, httpRequest, httpResponse);
        auditService.log("user_login", user.getEmail(), user.getFullName() + " signed in");
        return userService.toCurrentUserDto(user);
    }

    /** The signed-in user, or an empty 200 response for anonymous visitors. */
    @GetMapping("/me")
    public ResponseEntity<CurrentUserDto> me(Principal principal, HttpServletRequest request) {
        Optional<User> user = currentUserService.find(principal);
        if (user.isEmpty() || !user.get().isActive()) {
            if (principal != null) {
                // Deleted, renamed by someone else or deactivated: drop the stale session.
                authSessionService.clear(request);
            }
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.ok(userService.toCurrentUserDto(user.get()));
    }

    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest request) {
        User saved = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.toDto(saved));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, Principal principal) {
        if (principal != null) {
            auditService.log("user_logout", principal.getName(), principal.getName() + " signed out");
        }
        authSessionService.clear(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email")
    public CurrentUserDto changeEmail(@RequestBody Map<String, String> body,
                                      Principal principal,
                                      HttpServletRequest request,
                                      HttpServletResponse response) {
        User user = currentUserService.require(principal);
        String newEmail = userService.changeOwnEmail(user, body.get("email"), body.get("currentPassword"));
        // The session principal is the email address, so re-bind it or the user would be logged out.
        authSessionService.refreshPrincipal(newEmail, request, response);
        return userService.toCurrentUserDto(user);
    }

    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(@RequestBody Map<String, String> body, Principal principal) {
        User user = currentUserService.require(principal);
        userService.changeOwnPassword(user, body.get("currentPassword"), body.get("newPassword"));
        return ResponseEntity.noContent().build();
    }

    /** Always answers 204 so the response does not reveal which emails are registered. */
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        if (email == null || email.isBlank()) {
            throw ApiException.badRequest("Email is required");
        }
        passwordResetService.requestReset(email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody Map<String, String> body) {
        passwordResetService.resetPassword(body.get("token"), body.get("newPassword"));
        return ResponseEntity.noContent().build();
    }
}
