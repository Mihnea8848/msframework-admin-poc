package com.msframework.backend.service;

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
 * backend restarts. There is no mail server yet: the link is written to the backend log.
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
    private final PasswordPolicy passwordPolicy;
    private final UserSessionService userSessionService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Issues a reset link if the email belongs to an active account. Returns the link (for tests and
     * logging); callers must never send it back to the HTTP client.
     */
    @Transactional
    public Optional<String> requestReset(String rawEmail) {
        String email = UserService.normalizeEmail(rawEmail);
        tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());

        Optional<User> user = userRepository.findByEmailIgnoreCase(email).filter(User::isActive);
        if (user.isEmpty()) {
            return Optional.empty();
        }

        tokenRepository.deleteByUserId(user.get().getId());
        String token = SecureTokens.random(32);
        tokenRepository.save(PasswordResetToken.builder()
                .tokenHash(SecureTokens.sha256Hex(token))
                .userId(user.get().getId())
                .expiresAt(LocalDateTime.now().plus(TOKEN_LIFETIME))
                .build());

        String link = stripTrailingSlash(frontendUrl) + "/reset-password?token=" + token;
        log.info("Password reset link for {} (valid {} min): {}", user.get().getEmail(), TOKEN_LIFETIME.toMinutes(), link);
        auditService.log("password_reset_requested", user.get().getEmail(),
                user.get().getEmail() + " requested a password reset");
        return Optional.of(link);
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw ApiException.badRequest("Reset token is required");
        }
        passwordPolicy.validate(newPassword);

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
        // Whoever knew the old password is signed out too.
        userSessionService.revokeAll(user.getEmail());
        auditService.log("password_reset_completed", user.getEmail(), user.getEmail() + " reset their password");
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
