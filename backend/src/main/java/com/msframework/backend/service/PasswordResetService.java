package com.msframework.backend.service;

import com.msframework.backend.dto.PasswordResetLinkDto;
import com.msframework.backend.entity.PasswordResetToken;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.PasswordResetTokenRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Password reset with single-use, expiring tokens stored (hashed) in the database, so links survive
 * backend restarts. There is no mail server yet: the link is written to the backend log, or handed
 * to the administrator who asked for it.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final AuditService auditService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    private record IssuedLink(String link, LocalDateTime expiresAt) {
    }

    /**
     * Issues a reset link if the email belongs to an active account. Returns the link (for tests and
     * logging); callers must never send it back to the HTTP client.
     */
    @Transactional
    public Optional<String> requestReset(String rawEmail) {
        String email = UserService.normalizeEmail(rawEmail);
        Optional<User> user = userRepository.findByEmailIgnoreCase(email).filter(User::isActive);
        if (user.isEmpty()) {
            tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
            return Optional.empty();
        }

        IssuedLink issued = issue(user.get());
        log.info("Password reset link for {} (valid {} min): {}", user.get().getEmail(), TOKEN_LIFETIME.toMinutes(),
                issued.link());
        auditService.log("password_reset_requested", user.get().getEmail(),
                user.get().getEmail() + " requested a password reset", AuditService.Subject.user(user.get().getId()));
        return Optional.of(issued.link());
    }

    /**
     * An administrator (or the user's manager) makes a reset link for someone else, to hand over in
     * person until email exists. The same scope rules as editing the user apply. Any earlier link of
     * the user stops working.
     */
    @Transactional
    public PasswordResetLinkDto createLinkFor(Long userId, User actor) {
        User target = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        UserService.requireCanEdit(actor, target);
        if (!target.isActive()) {
            throw ApiException.conflict("This account is inactive. Activate it before resetting the password.");
        }

        IssuedLink issued = issue(target);
        log.info("Password reset link for {} created by {} (valid {} min)", target.getEmail(), actor.getEmail(),
                TOKEN_LIFETIME.toMinutes());
        auditService.log("password_reset_link_created", actor.getEmail(),
                actor.getEmail() + " created a password reset link for " + target.getEmail(),
                new AuditService.Subject(target.getId(),
                        target.getDepartment() != null ? target.getDepartment().getId() : null));
        return new PasswordResetLinkDto(issued.link(), Times.toOffset(issued.expiresAt()));
    }

    private IssuedLink issue(User user) {
        tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        tokenRepository.deleteByUserId(user.getId());
        String token = SecureTokens.random(32);
        LocalDateTime expiresAt = LocalDateTime.now().plus(TOKEN_LIFETIME);
        tokenRepository.save(PasswordResetToken.builder()
                .tokenHash(SecureTokens.sha256Hex(token))
                .userId(user.getId())
                .expiresAt(expiresAt)
                .build());
        return new IssuedLink(stripTrailingSlash(frontendUrl) + "/reset-password?token=" + token, expiresAt);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw ApiException.badRequest("Reset token is required");
        }
        UserService.validatePassword(newPassword);

        PasswordResetToken stored = tokenRepository.findByTokenHash(SecureTokens.sha256Hex(token.trim()))
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid or has already been used"));

        if (stored.getExpiresAt().isBefore(LocalDateTime.now())) {
            tokenRepository.delete(stored);
            throw ApiException.badRequest("This reset link has expired. Please request a new one.");
        }

        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid or has already been used"));

        userService.setPassword(user, newPassword);
        tokenRepository.deleteByUserId(user.getId());
        auditService.log("password_reset_completed", user.getEmail(), user.getEmail() + " reset their password",
                AuditService.Subject.user(user.getId()));
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
