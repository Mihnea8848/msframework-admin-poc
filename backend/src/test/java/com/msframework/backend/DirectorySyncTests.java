package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.config.AuthentikSettings;
import com.msframework.backend.dto.DirectoryDtos.DirectoryChange;
import com.msframework.backend.dto.DirectoryDtos.DirectorySyncResult;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.AuthentikClient;
import com.msframework.backend.service.DirectorySyncService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Directory sync against a local stub of the Authentik API (JDK HttpServer) that serves made-up
 * users and groups, two per page. No real names, emails or tokens appear here.
 */
@IntegrationTest
class DirectorySyncTests {

    private static final String ADMIN_EMAIL = "admin@test.com";
    private static final String ADMIN_PASSWORD = "password123";
    private static final String PASSWORD = "Secret#123";
    private static final String TOKEN = "stub-token-not-real";

    private static HttpServer server;
    private static final Stub STUB = new Stub();
    private static final AtomicInteger PK = new AtomicInteger(50_000);

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private AuthentikSettings settings;

    @Autowired
    private DirectorySyncService syncService;

    @Autowired
    private UserRepository userRepository;

    // ------------------------------------------------------------------ the stub

    /** One made-up Authentik user. */
    record AkUser(int pk, String username, String name, String email, boolean active, String type, List<String> groups) {
        AkUser withGroups(String... names) {
            return new AkUser(pk, username, name, email, active, type, List.of(names));
        }

        AkUser withName(String newName) {
            return new AkUser(pk, username, newName, email, active, type, groups);
        }

        AkUser inactive() {
            return new AkUser(pk, username, name, email, false, type, groups);
        }
    }

    /** Serves /api/v3/core/users/ and /api/v3/core/groups/ with Authentik's response shape. */
    static final class Stub {
        static final int PAGE = 2;
        final List<AkUser> users = new CopyOnWriteArrayList<>();
        final List<String> groups = new CopyOnWriteArrayList<>();
        final List<String> userAgents = new CopyOnWriteArrayList<>();
        final List<String> authorizations = new CopyOnWriteArrayList<>();
        final List<String> requests = new CopyOnWriteArrayList<>();
        volatile int failWith = 0;
        private final JsonMapper json = JsonMapper.builder().build();

        void reset() {
            users.clear();
            groups.clear();
            groups.addAll(List.of("director", "authentik Admins", "administrator", "employee", "community-member",
                    "honorary-member", "user", "admin-development", "admin-qualitycontrol", "admin-support",
                    "svc-readers"));
            userAgents.clear();
            authorizations.clear();
            requests.clear();
            failWith = 0;
        }

        static String groupPk(String name) {
            return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8)).toString();
        }

        void handle(HttpExchange exchange) throws IOException {
            String ua = exchange.getRequestHeaders().getFirst("User-Agent");
            userAgents.add(ua == null ? "" : ua);
            authorizations.add(String.valueOf(exchange.getRequestHeaders().getFirst("Authorization")));
            URI uri = exchange.getRequestURI();
            requests.add(exchange.getRequestMethod() + " " + uri);

            if (failWith != 0) {
                send(exchange, failWith, "{\"detail\":\"refused\"}");
                return;
            }
            // Like Cloudflare in front of the real server: default client agents are refused.
            if (ua == null || ua.startsWith("Java-http-client") || ua.startsWith("Python")) {
                send(exchange, 403, "<html>blocked</html>");
                return;
            }
            if (!("Bearer " + TOKEN).equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                send(exchange, 401, "{\"detail\":\"Token invalid\"}");
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                send(exchange, 405, "{}");
                return;
            }
            int page = page(uri.getQuery());
            String path = uri.getPath();
            if (path.equals("/api/v3/core/users/")) {
                List<Object> rows = new ArrayList<>();
                for (AkUser u : slice(users, page)) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("pk", u.pk());
                    row.put("uuid", UUID.nameUUIDFromBytes(("u" + u.pk()).getBytes(StandardCharsets.UTF_8)).toString());
                    row.put("username", u.username());
                    row.put("name", u.name());
                    row.put("email", u.email());
                    row.put("is_active", u.active());
                    row.put("type", u.type());
                    row.put("groups", u.groups().stream().map(Stub::groupPk).toList());
                    // Only the first group in groups_obj, so the sync must also resolve "groups" by pk.
                    row.put("groups_obj", u.groups().stream().limit(1)
                            .map(g -> Map.of("pk", groupPk(g), "name", g, "num_pk", 1)).toList());
                    row.put("attributes", Map.of());
                    rows.add(row);
                }
                send(exchange, 200, json.writeValueAsString(pageOf(users.size(), page, rows)));
            } else if (path.equals("/api/v3/core/groups/")) {
                List<Object> rows = new ArrayList<>();
                for (String g : slice(groups, page)) {
                    rows.add(Map.of("pk", groupPk(g), "name", g, "num_pk", 1, "is_superuser", false));
                }
                send(exchange, 200, json.writeValueAsString(pageOf(groups.size(), page, rows)));
            } else {
                send(exchange, 404, "{\"detail\":\"Not found\"}");
            }
        }

        private static <T> List<T> slice(List<T> all, int page) {
            int from = Math.min((page - 1) * PAGE, all.size());
            return all.subList(from, Math.min(from + PAGE, all.size()));
        }

        private static Map<String, Object> pageOf(int count, int page, List<Object> rows) {
            int pages = Math.max(1, (count + PAGE - 1) / PAGE);
            Map<String, Object> pagination = new LinkedHashMap<>();
            pagination.put("next", page < pages ? page + 1 : 0);
            pagination.put("previous", page > 1 ? page - 1 : 0);
            pagination.put("count", count);
            pagination.put("current", page);
            pagination.put("total_pages", pages);
            return Map.of("pagination", pagination, "results", rows);
        }

        private static int page(String query) {
            if (query == null) return 1;
            for (String part : query.split("&")) {
                if (part.startsWith("page=")) return Integer.parseInt(part.substring(5));
            }
            return 1;
        }

        private static void send(HttpExchange exchange, int status, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        }
    }

    @BeforeAll
    static void startStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try {
                STUB.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
    }

    @AfterAll
    static void stopStub() {
        if (server != null) server.stop(0);
    }

    @BeforeEach
    void pointAtStub() {
        STUB.reset();
        settings.setUrl("http://127.0.0.1:" + server.getAddress().getPort());
        settings.setToken(TOKEN);
        settings.setTokenFile("");
        // Each test starts with nobody linked, so users linked by an earlier test are left alone.
        jdbc.update("UPDATE users SET external_source = NULL, external_id = NULL, external_username = NULL "
                + "WHERE external_source = 'authentik'");
        clearSyncedManagers();
        jdbc.update("DELETE FROM org_settings WHERE key = 'directory.authentik.mapping'");
    }

    /** Departments headed by the sync get no head again, so other test classes see the seeded state. */
    private void clearSyncedManagers() {
        jdbc.update("UPDATE departments SET manager_id = NULL, manager_source = NULL WHERE manager_source = 'authentik'");
    }

    @AfterEach
    void switchOff() {
        settings.setUrl("");
        settings.setToken("");
        settings.setTokenFile("");
        clearSyncedManagers();
        jdbc.update("DELETE FROM org_settings WHERE key = 'directory.authentik.mapping'");
    }

    // ------------------------------------------------------------------ helpers

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private static AkUser person(String... groups) {
        int pk = PK.incrementAndGet();
        String tag = UUID.randomUUID().toString().substring(0, 8);
        return new AkUser(pk, "user" + tag, "Person " + tag, "person-" + tag + "@example.com", true, "internal",
                List.of(groups));
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private TestSession admin() throws Exception {
        return TestSession.login(mvc, ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    private String postJson(String path, TestSession session) throws Exception {
        return mvc.perform(post(path).with(session)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private static List<Map<String, Object>> changes(String body) {
        return JsonPath.read(body, "$.changes");
    }

    private static Map<String, Object> changeFor(String body, AkUser user) {
        List<Map<String, Object>> found = JsonPath.read(body, "$.changes[?(@.externalId == '" + user.pk() + "')]");
        assertThat(found).as("change for pk %s", user.pk()).hasSize(1);
        return found.getFirst();
    }

    private long createLocalUser(TestSession admin, String email, String role, Long departmentId) throws Exception {
        String body = "{\"fullName\":\"Local Person\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\""
                + (departmentId != null ? ",\"departmentId\":" + departmentId : "") + "}";
        MvcResult result = mvc.perform(json(post("/api/users"), body).with(admin))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createDepartment(TestSession admin, String name) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name + "\"}").with(admin))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private User userByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email).orElseThrow();
    }

    private String roleOf(long userId) {
        return jdbc.queryForObject("SELECT r.name FROM user_roles ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = ?",
                String.class, userId);
    }

    private Long departmentOf(long userId) {
        return jdbc.queryForObject("SELECT department_id FROM users WHERE id = ?", Long.class, userId);
    }

    private Long managerOf(long departmentId) {
        return jdbc.queryForObject("SELECT manager_id FROM departments WHERE id = ?", Long.class, departmentId);
    }

    private String statusOf(long userId) {
        return jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, userId);
    }

    private int sessionRows(String email) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM spring_session WHERE principal_name = ?", Integer.class, email);
    }

    // ------------------------------------------------------------------ status and access

    @Test
    void statusSaysWhetherTheSyncIsConfiguredAndNeverShowsTheToken() throws Exception {
        TestSession admin = admin();
        String body = mvc.perform(get("/api/directory/status").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.host").value("127.0.0.1"))
                .andExpect(jsonPath("$.tokenSource").value("env"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(TOKEN);

        settings.setUrl("");
        mvc.perform(get("/api/directory/status").with(admin))
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.host").doesNotExist());
        mvc.perform(post("/api/directory/sync/preview").with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("not configured")));
    }

    @Test
    void onlyAdminsMaySync() throws Exception {
        TestSession admin = admin();
        String email = unique("dir-manager");
        createLocalUser(admin, email, "MANAGER", 1L);
        TestSession manager = TestSession.login(mvc, email, PASSWORD);

        mvc.perform(get("/api/directory/status").with(manager)).andExpect(status().isForbidden());
        mvc.perform(post("/api/directory/sync/preview").with(manager)).andExpect(status().isForbidden());
        mvc.perform(post("/api/directory/sync").with(manager)).andExpect(status().isForbidden());
        mvc.perform(get("/api/directory/mapping").with(manager)).andExpect(status().isForbidden());
        assertThat(STUB.requests).isEmpty();
    }

    // ------------------------------------------------------------------ who is imported

    @Test
    void skipsNonStaffServiceAndSystemAccountsAndReadsEveryPage() throws Exception {
        AkUser staff = person("employee");
        AkUser community = person("community-member");
        AkUser honorary = person("honorary-member", "user");
        AkUser service = new AkUser(PK.incrementAndGet(), "svc-" + UUID.randomUUID(), "Mail reader", "", true,
                "service_account", List.of("svc-readers"));
        AkUser internalService = new AkUser(PK.incrementAndGet(), "ak-outpost-" + UUID.randomUUID(), "Outpost", null,
                true, "internal_service_account", List.of("employee"));
        AkUser system = new AkUser(PK.incrementAndGet(), "akadmin", "authentik Default Admin", unique("root"), true,
                "internal", List.of("authentik Admins"));
        AkUser noEmail = new AkUser(PK.incrementAndGet(), "noemail", "No Email", "not-an-email", true, "internal",
                List.of("employee"));
        AkUser inactive = person("employee").inactive();
        STUB.users.addAll(List.of(staff, community, honorary, service, internalService, system, noEmail, inactive));

        String body = postJson("/api/directory/sync/preview", admin());

        assertThat((Integer) JsonPath.read(body, "$.directoryUsers")).isEqualTo(8);
        assertThat(changeFor(body, staff)).containsEntry("action", "create").containsEntry("role", "MEMBER");
        assertThat(changeFor(body, community)).containsEntry("action", "skip").containsEntry("reason", "Not in a staff group");
        assertThat(changeFor(body, honorary)).containsEntry("reason", "Not in a staff group");
        assertThat(changeFor(body, service)).containsEntry("reason", "Service account");
        assertThat(changeFor(body, internalService)).containsEntry("reason", "Service account");
        assertThat(changeFor(body, system)).containsEntry("reason", "System account");
        assertThat(changeFor(body, noEmail)).containsEntry("reason", "No usable email address");
        assertThat(changeFor(body, inactive)).containsEntry("reason", "Inactive in Authentik and never imported");
        assertThat((Integer) JsonPath.read(body, "$.counts.created")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(body, "$.counts.skipped")).isEqualTo(7);

        // 8 users and 11 groups at 2 per page: 4 + 6 GET requests, nothing else.
        assertThat(STUB.requests).allMatch(r -> r.startsWith("GET "));
        assertThat(STUB.requests.stream().filter(r -> r.contains("/core/users/"))).hasSize(4);
        assertThat(STUB.requests.stream().filter(r -> r.contains("/core/groups/"))).hasSize(6)
                .allMatch(r -> r.contains("include_users=false"));
    }

    @Test
    void sendsAProperUserAgentAndTheBearerToken() throws Exception {
        STUB.users.add(person("employee"));
        postJson("/api/directory/sync/preview", admin());

        assertThat(STUB.userAgents).isNotEmpty().allMatch(AuthentikClient.USER_AGENT::equals);
        assertThat(STUB.authorizations).allMatch(("Bearer " + TOKEN)::equals);
    }

    @Test
    void theTokenCanComeFromAFile() throws Exception {
        java.nio.file.Path file = java.nio.file.Files.createTempFile("ak-token", ".txt");
        try {
            java.nio.file.Files.writeString(file, TOKEN + "\n");
            settings.setToken("");
            settings.setTokenFile(file.toString());
            STUB.users.add(person("employee"));
            TestSession admin = admin();
            mvc.perform(get("/api/directory/status").with(admin)).andExpect(jsonPath("$.tokenSource").value("file"));
            postJson("/api/directory/sync/preview", admin);
            assertThat(STUB.authorizations).allMatch(("Bearer " + TOKEN)::equals);
        } finally {
            java.nio.file.Files.deleteIfExists(file);
        }
    }

    // ------------------------------------------------------------------ roles and departments

    @Test
    void theHighestRoleWins() throws Exception {
        AkUser director = person("employee", "admin-development", "director");
        AkUser lead = person("employee", "admin-qualitycontrol");
        AkUser employee = person("employee");
        AkUser support = person("admin-support");
        STUB.users.addAll(List.of(director, lead, employee, support));

        String body = postJson("/api/directory/sync", admin());
        assertThat((Boolean) JsonPath.read(body, "$.dryRun")).isFalse();
        assertThat((Integer) JsonPath.read(body, "$.counts.created")).isEqualTo(4);

        assertThat(roleOf(userByEmail(director.email()).getId())).isEqualTo("ADMIN");
        assertThat(roleOf(userByEmail(lead.email()).getId())).isEqualTo("MANAGER");
        assertThat(roleOf(userByEmail(employee.email()).getId())).isEqualTo("MEMBER");
        assertThat(roleOf(userByEmail(support.email()).getId())).isEqualTo("MANAGER");
        // admin-support gives no department, and a plain employee has none either.
        assertThat(departmentOf(userByEmail(support.email()).getId())).isNull();
        assertThat(departmentOf(userByEmail(employee.email()).getId())).isNull();

        User imported = userByEmail(lead.email());
        assertThat(imported.getExternalSource()).isEqualTo("authentik");
        assertThat(imported.getExternalId()).isEqualTo(String.valueOf(lead.pk()));
        assertThat(imported.getExternalUsername()).isEqualTo(lead.username());
        assertThat(imported.isActive()).isTrue();
        // The password is a random hash nobody knows: signing in with anything fails.
        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + lead.email() + "\",\"password\":\"" + PASSWORD + "\"}")
                .with(TestSession.ANONYMOUS)).andExpect(status().isUnauthorized());

        // Running it again changes nothing.
        String again = postJson("/api/directory/sync", admin());
        assertThat((Integer) JsonPath.read(again, "$.counts.unchanged")).isEqualTo(4);
        assertThat((Integer) JsonPath.read(again, "$.counts.created")).isZero();
    }

    @Test
    void departmentsAndManagersFollowTheAdminGroups() throws Exception {
        TestSession admin = admin();
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        long alpha = createDepartment(admin, "Dir Alpha " + suffix);
        long beta = createDepartment(admin, "Dir Beta " + suffix);
        String mapping = """
                {"staffGroups":["employee","admin-*"],"adminGroups":["director"],"managerGroups":["admin-*"],
                 "memberGroups":["employee"],
                 "departments":{"admin-alpha":"Dir Alpha %s","admin-beta":"Dir Beta %s","admin-support":""},
                 "ignoredUsernames":["akadmin"]}""".formatted(suffix, suffix);
        mvc.perform(json(put("/api/directory/mapping"), mapping).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.custom").value(true));
        STUB.groups.addAll(List.of("admin-alpha", "admin-beta"));

        // Beta already has a manager chosen by an admin.
        String betaHeadEmail = unique("dir-beta-head");
        long betaHead = createLocalUser(admin, betaHeadEmail, "MANAGER", beta);
        mvc.perform(json(put("/api/departments/" + beta + "/manager"), "{\"userId\":" + betaHead + "}").with(admin))
                .andExpect(status().isOk());

        AkUser first = new AkUser(PK.incrementAndGet(), "a-first-" + suffix, "First Lead", unique("dir-first"), true,
                "internal", List.of("admin-alpha"));
        AkUser second = new AkUser(PK.incrementAndGet(), "b-second-" + suffix, "Second Lead", unique("dir-second"), true,
                "internal", List.of("admin-alpha", "employee"));
        AkUser betaLead = new AkUser(PK.incrementAndGet(), "c-beta-" + suffix, "Beta Lead", unique("dir-beta"), true,
                "internal", List.of("admin-beta"));
        STUB.users.addAll(List.of(first, second, betaLead));

        String body = postJson("/api/directory/sync", admin);
        long firstId = userByEmail(first.email()).getId();
        long secondId = userByEmail(second.email()).getId();
        long betaLeadId = userByEmail(betaLead.email()).getId();

        assertThat(departmentOf(firstId)).isEqualTo(alpha);
        assertThat(departmentOf(secondId)).isEqualTo(alpha);
        assertThat(departmentOf(betaLeadId)).isEqualTo(beta);
        assertThat(managerOf(alpha)).isEqualTo(firstId);
        assertThat(managerOf(beta)).as("an admin's choice is kept").isEqualTo(betaHead);
        assertThat((List<String>) changeFor(body, betaLead).get("notes")).anyMatch(n -> n.contains("chosen by an admin"));

        // The sync-chosen head leaves the staff groups: deactivated, and the next lead takes over.
        STUB.users.set(0, first.withGroups("community-member"));
        String after = postJson("/api/directory/sync", admin);
        assertThat(changeFor(after, first)).containsEntry("action", "deactivate");
        assertThat(statusOf(firstId)).isEqualTo("Inactive");
        assertThat(managerOf(alpha)).isEqualTo(secondId);
        assertThat(managerOf(beta)).isEqualTo(betaHead);

        // A department the mapping names but that does not exist cannot be saved.
        mvc.perform(json(put("/api/directory/mapping"), mapping.replace("Dir Beta " + suffix, "No Such Dept " + suffix))
                        .with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/directory/mapping").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.custom").value(false))
                .andExpect(jsonPath("$.mapping.departments['admin-development']").value("Development"));
    }

    // ------------------------------------------------------------------ linking and updates

    @Test
    void linksAnExistingLocalUserByEmail() throws Exception {
        TestSession admin = admin();
        String email = unique("dir-local");
        long localId = createLocalUser(admin, email, "VIEWER", 1L);
        AkUser same = new AkUser(PK.incrementAndGet(), "linkme", "Linked Person", email.toUpperCase(), true, "internal",
                List.of("employee"));
        STUB.users.add(same);

        String preview = postJson("/api/directory/sync/preview", admin);
        assertThat(changeFor(preview, same)).containsEntry("action", "link")
                .containsEntry("userId", (int) localId)
                .containsEntry("role", "MEMBER");

        long before = userRepository.count();
        postJson("/api/directory/sync", admin);
        assertThat(userRepository.count()).isEqualTo(before);
        User linked = userRepository.findById(localId).orElseThrow();
        assertThat(linked.getExternalSource()).isEqualTo("authentik");
        assertThat(linked.getExternalId()).isEqualTo(String.valueOf(same.pk()));
        assertThat(linked.getFullName()).isEqualTo("Linked Person");
        assertThat(linked.getEmail()).isEqualTo(email);
        assertThat(roleOf(localId)).isEqualTo("MEMBER");
        assertThat(departmentOf(localId)).as("no department group: the department is kept").isEqualTo(1L);
        // The local password still works.
        TestSession.login(mvc, email, PASSWORD);
    }

    @Test
    void localUsersAreNeverChanged() throws Exception {
        TestSession admin = admin();
        String email = unique("dir-untouched");
        long localId = createLocalUser(admin, email, "MEMBER", 1L);
        STUB.users.add(person("employee"));

        String body = postJson("/api/directory/sync", admin);
        assertThat(changes(body)).noneMatch(c -> c.get("userId") instanceof Number n && n.longValue() == localId);
        assertThat(statusOf(localId)).isEqualTo("Active");
        assertThat(userRepository.findById(localId).orElseThrow().getExternalSource()).isNull();
        assertThat(statusOf(userByEmail(ADMIN_EMAIL).getId())).isEqualTo("Active");
    }

    @Test
    void aNameChangeInAuthentikUpdatesTheUser() throws Exception {
        AkUser someone = person("employee");
        STUB.users.add(someone);
        TestSession admin = admin();
        postJson("/api/directory/sync", admin);
        long id = userByEmail(someone.email()).getId();

        STUB.users.set(0, someone.withName("Renamed Person"));
        String preview = postJson("/api/directory/sync/preview", admin);
        Map<String, Object> change = changeFor(preview, someone);
        assertThat(change).containsEntry("action", "update");
        assertThat((List<Map<String, Object>>) change.get("fields"))
                .containsExactly(Map.of("field", "name", "from", someone.name(), "to", "Renamed Person"));
        assertThat(userRepository.findById(id).orElseThrow().getFullName()).isEqualTo(someone.name());

        postJson("/api/directory/sync", admin);
        assertThat(userRepository.findById(id).orElseThrow().getFullName()).isEqualTo("Renamed Person");
        Integer audited = jdbc.queryForObject("SELECT COUNT(*) FROM audit_events WHERE event_type = 'user_updated' "
                + "AND actor_email = 'Authentik sync' AND subject_user_id = ?", Integer.class, id);
        assertThat(audited).isEqualTo(1);
        Integer created = jdbc.queryForObject("SELECT COUNT(*) FROM audit_events WHERE event_type = 'user_created' "
                + "AND actor_email = 'Authentik sync' AND subject_user_id = ?", Integer.class, id);
        assertThat(created).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT description FROM audit_events WHERE event_type = 'directory_synced' "
                + "ORDER BY id DESC LIMIT 1", String.class)).contains("1 updated");

        mvc.perform(get("/api/directory/status").with(admin))
                .andExpect(jsonPath("$.lastSyncBy").value(ADMIN_EMAIL))
                .andExpect(jsonPath("$.lastSyncCounts.updated").value(1))
                .andExpect(jsonPath("$.linkedUsers").value(1));
    }

    // ------------------------------------------------------------------ removals

    @Test
    void removedUsersAreDeactivatedAndSignedOut() throws Exception {
        TestSession admin = admin();
        String email = unique("dir-leaver");
        long id = createLocalUser(admin, email, "MEMBER", 1L);
        AkUser leaver = new AkUser(PK.incrementAndGet(), "leaver", "Leaving Person", email, true, "internal",
                List.of("employee"));
        AkUser gone = person("employee");
        AkUser turnedOff = person("employee");
        STUB.users.addAll(List.of(leaver, gone, turnedOff));
        postJson("/api/directory/sync", admin);

        TestSession session = TestSession.login(mvc, email, PASSWORD);
        assertThat(sessionRows(email)).isEqualTo(1);

        STUB.users.clear();
        STUB.users.addAll(List.of(leaver.withGroups("community-member"), turnedOff.inactive()));
        String body = postJson("/api/directory/sync", admin);

        assertThat(changeFor(body, leaver)).containsEntry("action", "deactivate").containsEntry("reason", "Not in a staff group");
        assertThat(changeFor(body, turnedOff)).containsEntry("reason", "Inactive in Authentik");
        assertThat(changeFor(body, gone)).containsEntry("action", "deactivate").containsEntry("reason", "No longer in Authentik");
        assertThat((Integer) JsonPath.read(body, "$.counts.deactivated")).isEqualTo(3);
        assertThat((Integer) JsonPath.read(body, "$.sessionsRevoked")).isEqualTo(1);

        assertThat(statusOf(id)).isEqualTo("Inactive");
        assertThat(userRepository.findById(id)).as("deactivated, never deleted").isPresent();
        assertThat(sessionRows(email)).isZero();
        mvc.perform(get("/api/users").with(session)).andExpect(status().isUnauthorized());
        assertThat(statusOf(userByEmail(gone.email()).getId())).isEqualTo("Inactive");

        // Back in a staff group: active again.
        STUB.users.set(0, leaver);
        String back = postJson("/api/directory/sync", admin);
        assertThat(changeFor(back, leaver)).containsEntry("action", "update");
        assertThat(statusOf(id)).isEqualTo("Active");
    }

    @Test
    void theLastActiveAdminIsNeverDeactivated() throws Exception {
        AkUser boss = person("director");
        STUB.users.add(boss);
        postJson("/api/directory/sync", admin());
        long bossId = userByEmail(boss.email()).getId();
        assertThat(roleOf(bossId)).isEqualTo("ADMIN");

        // Make the imported director the only active admin for a moment.
        List<Long> others = jdbc.queryForList("SELECT DISTINCT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id "
                + "JOIN role r ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND lower(u.status) = 'active' AND u.id <> ?",
                Long.class, bossId);
        try {
            others.forEach(id -> jdbc.update("UPDATE users SET status = 'Inactive' WHERE id = ?", id));
            STUB.users.set(0, boss.withGroups("community-member"));
            User actor = userRepository.findById(bossId).orElseThrow();

            DirectorySyncResult result = syncService.apply(actor);
            DirectoryChange change = result.changes().stream()
                    .filter(c -> String.valueOf(boss.pk()).equals(c.externalId())).findFirst().orElseThrow();
            assertThat(change.action()).isEqualTo("skip");
            assertThat(change.reason()).contains("last active admin");
            assertThat(result.counts().deactivated()).isZero();
            assertThat(statusOf(bossId)).isEqualTo("Active");

            // Demoting the last admin is refused the same way.
            STUB.users.set(0, boss.withGroups("employee"));
            DirectorySyncResult demote = syncService.apply(actor);
            DirectoryChange kept = demote.changes().stream()
                    .filter(c -> String.valueOf(boss.pk()).equals(c.externalId())).findFirst().orElseThrow();
            assertThat(kept.role()).isEqualTo("ADMIN");
            assertThat(kept.notes()).anyMatch(n -> n.contains("at least one active admin"));
            assertThat(roleOf(bossId)).isEqualTo("ADMIN");
        } finally {
            others.forEach(id -> jdbc.update("UPDATE users SET status = 'Active' WHERE id = ?", id));
        }
    }

    // ------------------------------------------------------------------ preview and errors

    @Test
    void aPreviewChangesNothing() throws Exception {
        TestSession admin = admin();
        String email = unique("dir-preview");
        long localId = createLocalUser(admin, email, "VIEWER", 1L);
        AkUser newcomer = person("employee", "admin-development");
        AkUser existing = new AkUser(PK.incrementAndGet(), "existing", "Preview Person", email, true, "internal",
                List.of("director"));
        STUB.users.addAll(List.of(newcomer, existing));

        long users = userRepository.count();
        Integer audit = jdbc.queryForObject("SELECT COUNT(*) FROM audit_events", Integer.class);
        String settingsRows = String.valueOf(jdbc.queryForList("SELECT key FROM org_settings ORDER BY key"));

        String body = postJson("/api/directory/sync/preview", admin);
        assertThat((Boolean) JsonPath.read(body, "$.dryRun")).isTrue();
        assertThat(changeFor(body, newcomer)).containsEntry("action", "create").containsEntry("applied", null)
                .containsEntry("role", "MANAGER").containsEntry("department", "Development");
        assertThat(changeFor(body, existing)).containsEntry("action", "link").containsEntry("role", "ADMIN");

        assertThat(userRepository.count()).isEqualTo(users);
        assertThat(userRepository.findByEmailIgnoreCase(newcomer.email())).isEmpty();
        assertThat(roleOf(localId)).isEqualTo("VIEWER");
        assertThat(userRepository.findById(localId).orElseThrow().getExternalSource()).isNull();
        // Sign-ins write audit events too, so compare after the one admin() above.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_events", Integer.class)).isEqualTo(audit);
        assertThat(String.valueOf(jdbc.queryForList("SELECT key FROM org_settings ORDER BY key"))).isEqualTo(settingsRows);
    }

    @Test
    void refusedTokensGiveAClearMessage() throws Exception {
        TestSession admin = admin();
        STUB.failWith = 401;
        mvc.perform(post("/api/directory/sync/preview").with(admin))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message", containsString("Authentik refused the token")));
        STUB.failWith = 403;
        mvc.perform(post("/api/directory/sync").with(admin))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message", containsString("Authentik refused the request (403)")));
        // The admin's own session is unaffected.
        mvc.perform(get("/api/auth/me").with(admin)).andExpect(status().isOk());

        STUB.failWith = 0;
        settings.setToken("wrong-token");
        mvc.perform(post("/api/directory/sync/preview").with(admin))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message", containsString("refused the token")));
    }

    @Test
    void anUnreachableServerGivesAClearMessage() throws Exception {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            closedPort = socket.getLocalPort();
        }
        settings.setUrl("http://127.0.0.1:" + closedPort);
        mvc.perform(post("/api/directory/sync/preview").with(admin()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message", containsString("Could not reach Authentik")));

        settings.setUrl("http://127.0.0.1:" + server.getAddress().getPort());
        settings.setToken("");
        mvc.perform(post("/api/directory/sync/preview").with(admin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("No Authentik token")));
        assertThat(Collections.unmodifiableList(STUB.requests)).isEmpty();
    }
}
