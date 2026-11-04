package com.msframework.backend.config;

import com.msframework.backend.exception.ApiException;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Where the Authentik directory is and how to authenticate to it, from the environment:
 * <ul>
 *   <li>{@code AUTHENTIK_URL}, e.g. {@code https://auth.example.net}. Empty switches directory sync off.</li>
 *   <li>{@code AUTHENTIK_TOKEN}, or {@code AUTHENTIK_TOKEN_FILE}: a file holding the token, read each
 *       time it is needed so a rotated token works without a restart.</li>
 * </ul>
 * The token is never logged and never sent to the browser. The setters exist for the tests, which
 * point the sync at a local stub.
 */
@Component
@Getter
@Setter
public class AuthentikSettings {

    @Value("${app.directory.authentik.url:}")
    private String url;

    @Value("${app.directory.authentik.token:}")
    private String token;

    @Value("${app.directory.authentik.token-file:}")
    private String tokenFile;

    /** True when a URL is set. The token is checked when it is used. */
    public boolean isConfigured() {
        return url != null && !url.isBlank();
    }

    /** "env", "file" or null: where the token comes from, for the status page (never the token). */
    public String tokenSource() {
        if (token != null && !token.isBlank()) return "env";
        if (tokenFile != null && !tokenFile.isBlank()) return "file";
        return null;
    }

    /** The base URL without a trailing slash; 400 when it is not an http(s) URL. */
    public URI baseUri() {
        if (!isConfigured()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Directory sync is not configured. Set AUTHENTIK_URL and AUTHENTIK_TOKEN_FILE on the server.");
        }
        String raw = url.trim().replaceAll("/+$", "");
        try {
            URI uri = new URI(raw);
            if (uri.getHost() == null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                throw new URISyntaxException(raw, "not an http(s) URL");
            }
            return uri;
        } catch (URISyntaxException e) {
            throw new ApiException(HttpStatus.CONFLICT, "AUTHENTIK_URL is not a valid http(s) URL.");
        }
    }

    /** The host name shown on the status page, or null when the URL is missing or invalid. */
    public String host() {
        if (!isConfigured()) return null;
        try {
            return baseUri().getHost();
        } catch (ApiException e) {
            return null;
        }
    }

    /** Reads the token now (from AUTHENTIK_TOKEN, else from the file). */
    public String readToken() {
        if (token != null && !token.isBlank()) return token.trim();
        if (tokenFile == null || tokenFile.isBlank()) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "No Authentik token. Set AUTHENTIK_TOKEN or AUTHENTIK_TOKEN_FILE on the server.");
        }
        String file = tokenFile.trim();
        if (file.startsWith("~/")) file = System.getProperty("user.home") + file.substring(1);
        try {
            String value = Files.readString(Path.of(file), StandardCharsets.UTF_8).trim();
            if (value.isEmpty()) throw new IOException("empty");
            return value;
        } catch (IOException | RuntimeException e) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "The Authentik token file (AUTHENTIK_TOKEN_FILE) is missing, unreadable or empty.");
        }
    }
}
