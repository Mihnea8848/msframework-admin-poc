package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.service.PasswordResetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end tests of the REST API through the real security filter chain.
 * Each test uses unique emails/names so tests do not depend on each other's data.
 */
@IntegrationTest
class ApiIntegrationTests {

    private static final String ADMIN_EMAIL = "admin@test.com";
    private static final String ADMIN_PASSWORD = "password123";
    private static final String PASSWORD = "Secret#123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PasswordResetService passwordResetService;

    // ------------------------------------------------------------------ helpers

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** A JSON request with a CSRF token; {@code .with(session)} afterwards adds the session. */
    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body).with(TestSession.ANONYMOUS);
    }

    private TestSession login(String email, String password) throws Exception {
        return TestSession.login(mvc, email, password);
    }

    private TestSession admin() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    private long createDepartment(TestSession admin, String name) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name + "\"}").with(admin))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createUser(TestSession admin, String email, String role, Long departmentId) throws Exception {
        String body = "{\"fullName\":\"Test User\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":" + departmentId + "}";
        MvcResult result = mvc.perform(json(post("/api/users"), body).with(admin))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private static String userUpdate(String email, String role, String status, Long departmentId) {
        return "{\"fullName\":\"Test User\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"" + status + "\",\"departmentId\":" + departmentId + "}";
    }

    // ------------------------------------------------------------------ authentication

    @Test
    void loginReturnsCurrentUserWithoutPasswordHash() throws Exception {
        mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"ADMIN@test.com\",\"password\":\"" + ADMIN_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(ADMIN_EMAIL))
                .andExpect(jsonPath("$.roles").value(hasItem("ADMIN")))
                .andExpect(jsonPath("$.permissions").value(hasItem("USER_CREATE")))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void wrongPasswordReturns401AndIsAudited() throws Exception {
        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"admin@test.com\",\"password\":\"nope\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));

        mvc.perform(get("/api/audit").param("limit", "20").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].eventType").value(hasItem("login_failed")));
    }

    @Test
    void anonymousApiCallsGetJson401() throws Exception {
        mvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Not authenticated"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isOk());
    }

    @Test
    void errorsKeepTheirRealStatusCode() throws Exception {
        TestSession admin = admin();
        mvc.perform(get("/api/does-not-exist").with(admin)).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/departments"), "{not json").with(admin)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/users/999999").with(admin)).andExpect(status().isNotFound());
    }

    @Test
    void userListNeverContainsPasswordHashes() throws Exception {
        String body = mvc.perform(get("/api/users").with(admin()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("password").doesNotContain("$2a$");
    }

    @Test
    void registrationValidatesInputAndCreatesAnAccessRequest() throws Exception {
        String email = unique("reg") + "@example.com";

        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please select a department"));

        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email + "\",\"departmentId\":1,\"password\":\"weak\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.message").value("Your request was sent. An administrator will review it."))
                .andExpect(jsonPath("$.password").doesNotExist());

        // No account yet; a second request for the same address is refused while the first waits.
        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Jane Doe\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email.toUpperCase() + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A request for this email is already waiting for approval."));
        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Admin Again\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + ADMIN_EMAIL + "\",\"departmentId\":1,\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict());
    }

    // ------------------------------------------------------------------ authorization

    @Test
    void membersCannotUseAdminEndpoints() throws Exception {
        String email = unique("member") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);
        TestSession member = login(email, PASSWORD);

        mvc.perform(json(post("/api/keys"), "{\"name\":\"x\"}").with(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/connections").with(member)).andExpect(status().isForbidden());
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"UTC\"}").with(member))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Dept") + "\"}").with(member))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/users/1").with(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/database/tables").with(member)).andExpect(status().isForbidden());
        // Audit entries other than exports cannot be forged from the browser.
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"dept_deleted\",\"description\":\"fake\"}")
                        .with(member))
                .andExpect(status().isBadRequest());
    }

    @Test
    void managersAreScopedToTheirOwnDepartment() throws Exception {
        TestSession admin = admin();
        long deptA = createDepartment(admin, unique("Alpha"));
        long deptB = createDepartment(admin, unique("Beta"));
        String managerEmail = unique("manager") + "@example.com";
        createUser(admin, managerEmail, "MANAGER", deptA);
        String memberAEmail = unique("a") + "@example.com";
        long memberA = createUser(admin, memberAEmail, "MEMBER", deptA);
        String memberBEmail = unique("b") + "@example.com";
        long memberB = createUser(admin, memberBEmail, "MEMBER", deptB);

        TestSession manager = login(managerEmail, PASSWORD);

        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "VIEWER", "Active", deptA)).with(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("VIEWER"));
        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "ADMIN", "Active", deptA)).with(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "MEMBER", "Active", deptB)).with(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(put("/api/users/" + memberB), userUpdate(memberBEmail, "MEMBER", "Active", deptB)).with(manager))
                .andExpect(status().isForbidden());

        mvc.perform(json(put("/api/departments/" + deptA), "{\"name\":\"" + unique("Alpha") + "\"}").with(manager))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/departments/" + deptB), "{\"name\":\"" + unique("Beta") + "\"}").with(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Gamma") + "\"}").with(manager))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ users

    @Test
    void adminCanCreateUpdateDeactivateAndDeleteUsers() throws Exception {
        TestSession admin = admin();
        String email = unique("crud") + "@example.com";
        long id = createUser(admin, email, "MEMBER", null);

        mvc.perform(json(put("/api/users/" + id), userUpdate(email, "MEMBER", "Inactive", null)).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Inactive"));

        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(startsWith("This account is inactive")));

        mvc.perform(delete("/api/users/" + id).with(admin)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/users/" + id).with(admin)).andExpect(status().isNotFound());
    }

    @Test
    void deactivatedUserLosesTheirSessionImmediately() throws Exception {
        TestSession admin = admin();
        String email = unique("kick") + "@example.com";
        long id = createUser(admin, email, "MEMBER", 1L);
        TestSession member = login(email, PASSWORD);

        mvc.perform(get("/api/users").with(member)).andExpect(status().isOk());
        mvc.perform(json(put("/api/users/" + id), userUpdate(email, "MEMBER", "Inactive", 1L)).with(admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users").with(member)).andExpect(status().isUnauthorized());
    }

    @Test
    void theLastActiveAdminIsProtected() throws Exception {
        TestSession admin = admin();
        mvc.perform(delete("/api/users/1").with(admin)).andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/users/1"), userUpdate(ADMIN_EMAIL, "MEMBER", "Active", null)).with(admin))
                .andExpect(status().isConflict());
        mvc.perform(json(put("/api/users/1"), userUpdate(ADMIN_EMAIL, "ADMIN", "Inactive", null)).with(admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changingOwnEmailKeepsTheSessionAndRequiresPassword() throws Exception {
        String email = unique("mail") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);
        TestSession session = login(email, PASSWORD);
        String newEmail = unique("renamed") + "@example.com";

        mvc.perform(json(post("/api/auth/email"), "{\"email\":\"" + newEmail + "\",\"currentPassword\":\"wrong\"}")
                        .with(session))
                .andExpect(status().isBadRequest());

        mvc.perform(json(post("/api/auth/email"), "{\"email\":\"" + newEmail + "\",\"currentPassword\":\"" + PASSWORD + "\"}")
                        .with(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));

        mvc.perform(get("/api/auth/me").with(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));
        mvc.perform(get("/api/users").with(session)).andExpect(status().isOk());
    }

    @Test
    void changingPasswordWorks() throws Exception {
        String email = unique("pw") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);
        TestSession session = login(email, PASSWORD);

        mvc.perform(json(post("/api/auth/password"), "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"short\"}")
                        .with(session))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/auth/password"), "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"Another#456\"}")
                        .with(session))
                .andExpect(status().isNoContent());
        login(email, "Another#456");
    }

    @Test
    void passwordResetTokensAreSingleUse() throws Exception {
        String email = unique("reset") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);

        String link = passwordResetService.requestReset(email).orElseThrow();
        String token = link.substring(link.indexOf("token=") + "token=".length());

        mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"" + token + "\",\"newPassword\":\"Reset#789\"}"))
                .andExpect(status().isNoContent());
        login(email, "Reset#789");
        mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"" + token + "\",\"newPassword\":\"Again#789\"}"))
                .andExpect(status().isBadRequest());

        // Unknown emails get the same answer as known ones.
        mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"nobody@example.com\"}"))
                .andExpect(status().isNoContent());
    }

    // ------------------------------------------------------------------ departments

    @Test
    void deletingADepartmentUnassignsItsMembers() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Temp"));
        String email = unique("dept") + "@example.com";
        long userId = createUser(admin, email, "MEMBER", dept);

        mvc.perform(delete("/api/departments/" + dept).with(admin)).andExpect(status().isNoContent());

        String users = mvc.perform(get("/api/users").with(admin)).andReturn().getResponse().getContentAsString();
        Object departmentId = JsonPath.read(users, "$[?(@.id == " + userId + ")].departmentId");
        assertThat(departmentId.toString()).isEqualTo("[null]");
    }

    @Test
    void departmentNamesAreValidatedAndUnique() throws Exception {
        TestSession admin = admin();
        String name = unique("Unique");
        createDepartment(admin, name);
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name.toUpperCase() + "\"}").with(admin))
                .andExpect(status().isConflict());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"   \"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Bad") + "\",\"color\":\"red; x\"}").with(admin))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ connections, keys, settings

    @Test
    void apiKeySecretIsReturnedOnlyOnce() throws Exception {
        TestSession admin = admin();
        MvcResult created = mvc.perform(json(post("/api/keys"), "{\"name\":\"CI key\"}").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.secret").value(startsWith("msk_")))
                .andReturn();
        String secret = JsonPath.read(created.getResponse().getContentAsString(), "$.secret");

        String list = mvc.perform(get("/api/keys").with(admin)).andReturn().getResponse().getContentAsString();
        assertThat(list).contains("CI key").doesNotContain(secret).doesNotContain("\"secret\"");
    }

    @Test
    void integrationsAndWebhooksValidateInput() throws Exception {
        TestSession admin = admin();
        mvc.perform(get("/api/connections").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12));
        mvc.perform(post("/api/connections/not-a-service/connect").with(admin)).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"javascript:alert(1)\"}").with(admin))
                .andExpect(status().isBadRequest());

        MvcResult created = mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/hook\",\"events\":[\"*\"]}")
                        .with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        mvc.perform(patch("/api/webhooks/" + id + "/toggle").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void settingsAreValidated() throws Exception {
        TestSession admin = admin();
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"Mars/Olympus\"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"Europe/Bucharest\"}").with(admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/settings/orgTimezone").with(admin))
                .andExpect(jsonPath("$.value").value("Europe/Bucharest"));

        mvc.perform(json(put("/api/settings/worldClocks"),
                        "{\"value\":\"[{\\\"label\\\":\\\"Cluj\\\",\\\"tz\\\":\\\"Europe/Bucharest\\\"}]\"}").with(admin))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/settings/worldClocks"), "{\"value\":\"not json\"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/settings/somethingElse"), "{\"value\":\"x\"}").with(admin))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ typed request bodies

    @Test
    void apiKeyBodyAndNameAreOptional() throws Exception {
        TestSession admin = admin();
        // No body at all, an empty object and a blank name all get the default name.
        mvc.perform(post("/api/keys").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{}").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{\"name\":\"   \"}").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{\"name\":\"" + "k".repeat(61) + "\"}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Key name must be at most 60 characters"));
    }

    @Test
    void webhookEventsDefaultToEverything() throws Exception {
        TestSession admin = admin();
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/no-events\"}").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("*"));
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/empty\",\"events\":[]}").with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("*"));
        mvc.perform(json(post("/api/webhooks"),
                        "{\"url\":\"https://example.com/list\",\"events\":[\"user.created\",\" user.deleted \",\"user.created\"]}")
                        .with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("user.created,user.deleted"));
        // The comma-separated string accepted by the untyped body still works.
        mvc.perform(json(post("/api/webhooks"),
                        "{\"url\":\"https://example.com/string\",\"events\":\"user.created, dept.deleted\"}")
                        .with(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("user.created,dept.deleted"));
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/bad\",\"events\":[\"Bad Event\"]}")
                        .with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid event name: Bad Event"));
        mvc.perform(json(post("/api/webhooks"), "{\"events\":[\"*\"]}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Webhook URL is required"));
    }

    @Test
    void missingFieldsGetTheSameMessagesAsBefore() throws Exception {
        mvc.perform(json(post("/api/auth/forgot-password"), "{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Email is required"));
        mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Email is required"));
        // Unknown fields are ignored, as they were with the untyped body.
        mvc.perform(json(post("/api/auth/forgot-password"), "{\"email\":\"nobody@example.com\",\"extra\":1}"))
                .andExpect(status().isNoContent());

        TestSession admin = admin();
        mvc.perform(json(post("/api/auth/password"), "{\"newPassword\":\"Whatever#123\"}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));
        mvc.perform(json(put("/api/settings/orgTimezone"), "{}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Timezone is required"));
        mvc.perform(json(post("/api/audit/event"), "{}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unsupported event type"));

        // A missing description falls back to the default text.
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"export_generated\"}").with(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/audit").param("limit", "1").with(admin))
                .andExpect(jsonPath("$[0].eventType").value("export_generated"))
                .andExpect(jsonPath("$[0].description").value("Exported data"));
    }

    @Test
    void everyoneReadsTheirOwnActivityButOnlyAuditorsReadTheFullLog() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Mine"));
        String email = unique("mine") + "@example.com";
        long id = createUser(admin, email, "MEMBER", dept);
        TestSession member = login(email, PASSWORD);
        // An event about someone else, after the member's sign-in: it must not reach their feed.
        createUser(admin, unique("other") + "@example.com", "MEMBER", dept);

        mvc.perform(get("/api/audit").with(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/audit/me")).andExpect(status().isUnauthorized());

        String first = mvc.perform(get("/api/audit/me").param("limit", "1").with(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].eventType").value("user_login"))
                .andExpect(jsonPath("$.items[0].actorEmail").value(email))
                .andExpect(jsonPath("$.nextCursor").value(notNullValue()))
                .andReturn().getResponse().getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(get("/api/audit/me").param("cursor", cursor).with(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].eventType").value(contains("user_created")))
                .andExpect(jsonPath("$.items[0].subjectUserId").value(id))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(get("/api/audit/me").param("cursor", "not-a-cursor").with(member))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedBodiesGiveA400JsonError() throws Exception {
        TestSession admin = admin();
        String[][] requests = {
                {"/api/auth/forgot-password", "{not json"},
                {"/api/auth/reset-password", "[1, 2]"},
                {"/api/auth/email", "{\"email\":{\"nested\":true}}"},
                {"/api/webhooks", "{\"url\":\"https://example.com/x\",\"events\":{\"a\":1}}"},
                {"/api/keys", "{\"name\":"},
        };
        for (String[] request : requests) {
            mvc.perform(json(post(request[0]), request[1]).with(admin))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Bad Request"))
                    .andExpect(jsonPath("$.message").value("Malformed request body"));
        }
        mvc.perform(json(put("/api/settings/worldClocks"), "{\"value\":[{\"label\":\"Cluj\"}]}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request body"));
    }

    // ------------------------------------------------------------------ import, database, audit

    @Test
    void importCreatesValidRowsAndReportsTheRest() throws Exception {
        TestSession admin = admin();
        String a = unique("imp") + "@example.com";
        String b = unique("imp") + "@example.com";
        String body = "{\"rows\":["
                + "{\"fullName\":\"Ana Pop\",\"email\":\"" + a + "\",\"role\":\"MEMBER\",\"status\":\"active\",\"department\":\"development\"},"
                + "{\"fullName\":\"Ion Pop\",\"email\":\"" + b + "\",\"role\":\"viewer\",\"status\":\"\",\"department\":\"\"},"
                + "{\"fullName\":\"Bad Mail\",\"email\":\"not-an-email\"},"
                + "{\"fullName\":\"Dup\",\"email\":\"" + a + "\"},"
                + "{\"fullName\":\"No Dept\",\"email\":\"" + unique("x") + "@example.com\",\"department\":\"Nowhere\"}"
                + "]}";

        mvc.perform(json(post("/api/import/users"), body).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.skipped").value(3))
                .andExpect(jsonPath("$.errors[0].row").value(3));

        mvc.perform(json(post("/api/import/departments"),
                        "{\"rows\":[{\"name\":\"" + unique("Imported") + "\",\"color\":\"avatar-rose\"},{\"name\":\"Development\"}]}")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.skipped").value(1));
    }

    @Test
    void databasePageListsRealTables() throws Exception {
        mvc.perform(get("/api/database/tables").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name").value(hasItem("users")))
                .andExpect(jsonPath("$[*].name").value(hasItem("departments")))
                .andExpect(jsonPath("$[0].columns[*].name").value(hasItem("email")));
    }

    @Test
    void exportEventsCanBeLoggedByPermittedUsers() throws Exception {
        TestSession admin = admin();
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"export_generated\",\"description\":\"Exported users CSV\"}")
                        .with(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/audit").param("limit", "5").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].eventType").value(hasItem("export_generated")))
                .andExpect(jsonPath("$[0].createdAt").value(not(org.hamcrest.Matchers.emptyOrNullString())));
    }
}
