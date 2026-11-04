package com.msframework.backend.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.msframework.backend.config.AuthentikSettings;
import com.msframework.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads users and groups from the Authentik API (v3) with GET requests only. Sends a normal
 * User-Agent: Cloudflare in front of Authentik rejects some default client agents with 403.
 * Every failure becomes an {@link ApiException} with status 502 and a message for the admin;
 * 401 is never passed on, because the browser would take it as its own session ending.
 */
@Component
public class AuthentikClient {

    public static final String USER_AGENT = "MSFramework-DirectorySync/1.0";
    static final int PAGE_SIZE = 100;
    /** Upper bound on pages, so a misbehaving server cannot keep the sync looping. */
    private static final int MAX_PAGES = 200;
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private static final Logger log = LoggerFactory.getLogger(AuthentikClient.class);

    private final AuthentikSettings settings;
    private final JsonMapper jsonMapper;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public AuthentikClient(AuthentikSettings settings, JsonMapper jsonMapper) {
        this.settings = settings;
        this.jsonMapper = jsonMapper;
    }

    /** One Authentik user, with the names of their groups resolved. */
    public record DirectoryUser(String pk, String uuid, String username, String name, String email,
                                boolean active, String type, Set<String> groups) {
    }

    /** Everything the sync needs, read in one go. */
    public record Snapshot(List<DirectoryUser> users, Set<String> groupNames) {
    }

    // The parts of the Authentik responses that are used. Unknown fields are ignored.
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Pagination(Integer next, Integer current) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GroupRef(String pk, String name) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UserRow(Object pk, String uuid, String username, String name, String email,
                   @JsonProperty("is_active") Boolean isActive, String type, List<String> groups,
                   @JsonProperty("groups_obj") List<GroupRef> groupsObj) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record UserPage(Pagination pagination, List<UserRow> results) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record GroupPage(Pagination pagination, List<GroupRef> results) {
    }

    public Snapshot fetch() {
        URI base = settings.baseUri();
        String token = settings.readToken();

        Map<String, String> groupNames = new HashMap<>();
        for (GroupRef group : pages(base, token, "/api/v3/core/groups/?page_size=" + PAGE_SIZE + "&include_users=false",
                GroupPage.class, GroupPage::pagination, GroupPage::results)) {
            if (group.pk() != null && group.name() != null) groupNames.put(group.pk(), group.name());
        }

        List<DirectoryUser> users = new ArrayList<>();
        for (UserRow row : pages(base, token, "/api/v3/core/users/?page_size=" + PAGE_SIZE,
                UserPage.class, UserPage::pagination, UserPage::results)) {
            if (row.pk() == null) continue;
            Set<String> groups = new LinkedHashSet<>();
            if (row.groupsObj() != null) {
                row.groupsObj().stream().map(GroupRef::name).filter(n -> n != null && !n.isBlank()).forEach(groups::add);
            }
            if (row.groups() != null) {
                row.groups().stream().map(groupNames::get).filter(n -> n != null && !n.isBlank()).forEach(groups::add);
            }
            users.add(new DirectoryUser(String.valueOf(row.pk()), row.uuid(), row.username(), row.name(), row.email(),
                    Boolean.TRUE.equals(row.isActive()), row.type(), groups));
        }
        return new Snapshot(users, new LinkedHashSet<>(groupNames.values()));
    }

    private <P, T> List<T> pages(URI base, String token, String firstPath, Class<P> type,
                                 java.util.function.Function<P, Pagination> pagination,
                                 java.util.function.Function<P, List<T>> results) {
        List<T> all = new ArrayList<>();
        int page = 1;
        for (int i = 0; i < MAX_PAGES; i++) {
            P body = get(base, token, firstPath + "&page=" + page, type);
            List<T> rows = results.apply(body);
            if (rows == null) throw badResponse(base);
            all.addAll(rows);
            Pagination p = pagination.apply(body);
            int next = p == null || p.next() == null ? 0 : p.next();
            if (next <= page || rows.isEmpty()) return all;
            page = next;
        }
        throw new ApiException(HttpStatus.BAD_GATEWAY,
                "Authentik returned more than " + MAX_PAGES + " pages. The sync stopped to be safe.");
    }

    private <P> P get(URI base, String token, String path, Class<P> type) {
        URI uri = URI.create(base + path);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .header("User-Agent", USER_AGENT)
                .GET()
                .build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            throw unreachable(base, "it did not answer in time");
        } catch (IOException e) {
            throw unreachable(base, "the connection failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unreachable(base, "the request was interrupted");
        }

        int status = response.statusCode();
        if (status == 401) {
            log.warn("[DIRECTORY] Authentik at {} answered 401 to {}", base.getHost(), uri.getPath());
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Authentik refused the token (401). Check AUTHENTIK_TOKEN or AUTHENTIK_TOKEN_FILE on the server.");
        }
        if (status == 403) {
            log.warn("[DIRECTORY] Authentik at {} answered 403 to {}", base.getHost(), uri.getPath());
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Authentik refused the request (403). The token may not be allowed to read users and groups, "
                            + "or a firewall in front of Authentik blocked it.");
        }
        if (status >= 300 && status < 400) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Authentik answered with a redirect (" + status + "). Check AUTHENTIK_URL (https, no path).");
        }
        if (status < 200 || status >= 300) {
            log.warn("[DIRECTORY] Authentik at {} answered {} to {}", base.getHost(), status, uri.getPath());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Authentik answered with an error (HTTP " + status + ").");
        }
        try {
            P body = jsonMapper.readValue(response.body(), type);
            if (body == null) throw badResponse(base);
            return body;
        } catch (JacksonException e) {
            throw badResponse(base);
        }
    }

    private static ApiException unreachable(URI base, String why) {
        log.warn("[DIRECTORY] Could not reach Authentik at {}: {}", base.getHost(), why);
        return new ApiException(HttpStatus.BAD_GATEWAY,
                "Could not reach Authentik at " + base.getHost() + ": " + why + ".");
    }

    private static ApiException badResponse(URI base) {
        return new ApiException(HttpStatus.BAD_GATEWAY,
                "Authentik at " + base.getHost() + " sent an answer that is not a user or group list. Check AUTHENTIK_URL.");
    }
}
