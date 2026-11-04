package com.msframework.backend.service;

import com.msframework.backend.exception.ApiException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The rules for new passwords (same as {@code frontend/src/utils/validators.ts}): the
 * organisation's minimum length (8 by default), at most 72 bytes (the BCrypt limit), a number, a
 * symbol, and not one of the most common passwords ({@code security/common-passwords.txt}).
 *
 * <p>Only new passwords are checked; existing hashes (such as the seeded admin's) keep working.</p>
 */
@Component
public class PasswordPolicy {

    static final String BLOCKLIST = "security/common-passwords.txt";

    private static final Pattern DIGIT = Pattern.compile("[0-9]");
    private static final Pattern SYMBOL = Pattern.compile("[^A-Za-z0-9]");

    private final OrgSettingsService orgSettings;
    private final Set<String> common;

    public PasswordPolicy(OrgSettingsService orgSettings) {
        this.orgSettings = orgSettings;
        this.common = loadBlocklist();
    }

    public void validate(String password) {
        int minLength = orgSettings.passwordMinLength();
        if (password == null || password.length() < minLength) {
            throw ApiException.badRequest("Password must be at least " + minLength + " characters long");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.badRequest("Password is too long (maximum 72 bytes)");
        }
        if (!DIGIT.matcher(password).find()) {
            throw ApiException.badRequest("Password must include a number");
        }
        if (!SYMBOL.matcher(password).find()) {
            throw ApiException.badRequest("Password must include a symbol");
        }
        if (isCommon(password)) {
            throw ApiException.badRequest("This password is too common. Choose one that is harder to guess.");
        }
    }

    public boolean isCommon(String password) {
        return password != null && common.contains(password.toLowerCase(Locale.ROOT));
    }

    /** The blocklist, lowercased. Lines starting with "# " are comments. */
    public static Set<String> loadBlocklist() {
        Set<String> entries = new HashSet<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource(BLOCKLIST).getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty() || line.startsWith("# ")) continue;
                entries.add(line.toLowerCase(Locale.ROOT));
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + BLOCKLIST, e);
        }
        return Collections.unmodifiableSet(entries);
    }
}
