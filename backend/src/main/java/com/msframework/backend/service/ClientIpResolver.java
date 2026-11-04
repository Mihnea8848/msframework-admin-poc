package com.msframework.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The client's IP address, for throttling and the sessions list.
 *
 * <p>By default this is the TCP peer address. {@code X-Forwarded-For} can be forged by any client,
 * so it is used only when {@code app.security.trusted-proxy} ({@code TRUSTED_PROXY}) is true, which
 * means the backend is reachable only through one reverse proxy. Then the last address in the
 * header is the one that proxy saw, and it is used.</p>
 */
@Component
public class ClientIpResolver {

    private final boolean trustedProxy;

    public ClientIpResolver(@Value("${app.security.trusted-proxy:false}") boolean trustedProxy) {
        this.trustedProxy = trustedProxy;
    }

    public String resolve(HttpServletRequest request) {
        if (trustedProxy) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] hops = forwarded.split(",");
                String last = hops[hops.length - 1].trim();
                if (!last.isEmpty() && last.length() <= 64) {
                    return last;
                }
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null || remote.isBlank() ? "unknown" : remote;
    }
}
