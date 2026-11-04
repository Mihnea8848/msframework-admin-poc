package com.msframework.backend.controller;

import com.msframework.backend.dto.ChangeEmailRequest;
import com.msframework.backend.dto.ChangePasswordRequest;
import com.msframework.backend.dto.CurrentUserDto;
import com.msframework.backend.dto.ForgotPasswordRequest;
import com.msframework.backend.dto.LoginRequest;
import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.dto.RegisterResponse;
import com.msframework.backend.dto.ResetPasswordRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AccessRequestService;
import com.msframework.backend.service.AuditService;
import com.msframework.backend.service.AuthSessionService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.PasswordResetService;
import com.msframework.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import java.time.LocalDateTime;
import java.util.Optional;

@Tag(name = "Auth", description = "Sign-in, registration, password reset and the caller's own account")
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
    private final AccessRequestService accessRequestService;

    @Operation(operationId = "login", summary = "Sign in and start a session",
            description = "Sets the session cookie. An inactive account gets 403.")
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
            Optional<String> pending = accessRequestService.pendingSignInMessage(email, request.password());
            if (pending.isPresent()) {
                auditService.log("login_pending", email, "Sign-in before approval by " + email);
                throw ApiException.forbidden(pending.get());
            }
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
        userRepository.touchLastLogin(user.getId(), LocalDateTime.now());
        auditService.log("user_login", user.getEmail(), user.getFullName() + " signed in",
                AuditService.Subject.user(user.getId()));
        return userService.toCurrentUserDto(user);
    }

    /** The signed-in user, or an empty 200 response for anonymous visitors. */
    @Operation(operationId = "getCurrentUser", summary = "The signed-in user",
            description = "Answers 200 with an empty body when nobody is signed in.")
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

    @Operation(operationId = "register", summary = "Ask for an account",
            description = "Creates an access request, not an account: an administrator approves it (the account "
                    + "then gets this password) or rejects it. Signing in before approval answers 403 with a "
                    + "message saying the request is still waiting.")
    @ApiResponse(responseCode = "202", description = "Request recorded; show the message")
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        accessRequestService.submit(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new RegisterResponse(AccessRequestService.SUBMITTED_MESSAGE));
    }

    @Operation(operationId = "logout", summary = "Sign out and end the session")
    @ApiResponse(responseCode = "204", description = "Signed out")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, Principal principal) {
        if (principal != null) {
            auditService.log("user_logout", principal.getName(), principal.getName() + " signed out");
        }
        authSessionService.clear(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "changeOwnEmail", summary = "Change the caller's email address",
            description = "The session stays valid.")
    @PostMapping("/email")
    public CurrentUserDto changeEmail(@RequestBody ChangeEmailRequest body,
                                      Principal principal,
                                      HttpServletRequest request,
                                      HttpServletResponse response) {
        User user = currentUserService.require(principal);
        String newEmail = userService.changeOwnEmail(user, body.email(), body.currentPassword());
        // The session principal is the email address, so re-bind it or the user would be logged out.
        authSessionService.refreshPrincipal(newEmail, request, response);
        return userService.toCurrentUserDto(user);
    }

    @Operation(operationId = "changeOwnPassword", summary = "Change the caller's password")
    @ApiResponse(responseCode = "204", description = "Password changed")
    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(@RequestBody ChangePasswordRequest body, Principal principal) {
        User user = currentUserService.require(principal);
        userService.changeOwnPassword(user, body.currentPassword(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    /** Always answers 204 so the response does not reveal which emails are registered. */
    @Operation(operationId = "requestPasswordReset", summary = "Request a password reset link",
            description = "Answers 204 whether or not the email is registered.")
    @ApiResponse(responseCode = "204", description = "Accepted")
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@RequestBody ForgotPasswordRequest body) {
        String email = body.email();
        if (email == null || email.isBlank()) {
            throw ApiException.badRequest("Email is required");
        }
        passwordResetService.requestReset(email);
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "resetPassword", summary = "Set a new password with a reset token")
    @ApiResponse(responseCode = "204", description = "Password changed")
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetPasswordRequest body) {
        passwordResetService.resetPassword(body.token(), body.newPassword());
        return ResponseEntity.noContent().build();
    }
}
