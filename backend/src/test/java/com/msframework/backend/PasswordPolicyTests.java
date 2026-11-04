package com.msframework.backend;

import com.msframework.backend.service.PasswordPolicy;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The common-password blocklist exists twice: the full list in the backend and the entries that
 * can matter in the frontend ({@code frontend/src/utils/commonPasswords.ts}). This keeps them in
 * sync. No Spring context is needed.
 */
class PasswordPolicyTests {

    private static final Pattern TS_ENTRY = Pattern.compile("^\\s*\"((?:[^\"\\\\]|\\\\.)*)\",\\s*$");

    @Test
    void blocklistHasAboutAThousandLowercaseEntries() {
        Set<String> backend = PasswordPolicy.loadBlocklist();
        assertThat(backend).hasSizeBetween(900, 1100);
        assertThat(backend).allSatisfy(entry -> assertThat(entry).isLowerCase().doesNotContainAnyWhitespaces());
        assertThat(backend).contains("password1!", "p@ssw0rd", "qwerty123");
    }

    @Test
    void frontendMirrorsEveryEntryThatPassesTheOtherRules() throws Exception {
        Set<String> backend = PasswordPolicy.loadBlocklist();
        Set<String> relevant = backend.stream()
                .filter(PasswordPolicyTests::passesBaseRules)
                .collect(Collectors.toCollection(TreeSet::new));

        Set<String> frontend = new TreeSet<>();
        Path file = repositoryRoot().resolve("frontend/src/utils/commonPasswords.ts");
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            Matcher matcher = TS_ENTRY.matcher(line);
            if (matcher.matches()) {
                frontend.add(matcher.group(1).replace("\\\"", "\"").replace("\\\\", "\\"));
            }
        }

        assertThat(frontend).as("entries in %s", file).isEqualTo(relevant);
    }

    private static boolean passesBaseRules(String password) {
        return password.length() >= 8
                && password.getBytes(StandardCharsets.UTF_8).length <= 72
                && password.chars().anyMatch(Character::isDigit)
                && password.chars().anyMatch(c -> !(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z')
                && !(c >= '0' && c <= '9'));
    }

    private static Path repositoryRoot() throws Exception {
        Path dir = Path.of(PasswordPolicyTests.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        for (Path candidate = dir; candidate != null; candidate = candidate.getParent()) {
            if (Files.isRegularFile(candidate.resolve("backend/pom.xml"))) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find the repository root above " + dir);
    }
}
