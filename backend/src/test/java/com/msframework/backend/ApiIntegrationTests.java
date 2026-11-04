package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.service.PasswordResetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
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

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpSession login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession admin() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    private long createDepartment(MockHttpSession admin, String name) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name + "\"}").session(admin))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createUser(MockHttpSession admin, String email, String role, Long departmentId) throws Exception {
        String body = "{\"fullName\":\"Test User\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":" + departmentId + "}";
        MvcResult result = mvc.perform(json(post("/api/users"), body).session(admin))
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

        mvc.perform(get("/api/audit").param("limit", "20").session(admin()))
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
        MockHttpSession admin = admin();
        mvc.perform(get("/api/does-not-exist").session(admin)).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/departments"), "{not json").session(admin)).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/users/999999").session(admin)).andExpect(status().isNotFound());
    }

    @Test
    void userListNeverContainsPasswordHashes() throws Exception {
        String body = mvc.perform(get("/api/users").session(admin()))
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
        MockHttpSession member = login(email, PASSWORD);

        mvc.perform(json(post("/api/keys"), "{\"name\":\"x\"}").session(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/connections").session(member)).andExpect(status().isForbidden());
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"UTC\"}").session(member))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Dept") + "\"}").session(member))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/users/1").session(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/database/tables").session(member)).andExpect(status().isForbidden());
        // Audit entries other than exports cannot be forged from the browser.
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"dept_deleted\",\"description\":\"fake\"}")
                        .session(member))
                .andExpect(status().isBadRequest());
    }

    @Test
    void managersAreScopedToTheirOwnDepartment() throws Exception {
        MockHttpSession admin = admin();
        long deptA = createDepartment(admin, unique("Alpha"));
        long deptB = createDepartment(admin, unique("Beta"));
        String managerEmail = unique("manager") + "@example.com";
        createUser(admin, managerEmail, "MANAGER", deptA);
        String memberAEmail = unique("a") + "@example.com";
        long memberA = createUser(admin, memberAEmail, "MEMBER", deptA);
        String memberBEmail = unique("b") + "@example.com";
        long memberB = createUser(admin, memberBEmail, "MEMBER", deptB);

        MockHttpSession manager = login(managerEmail, PASSWORD);

        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "VIEWER", "Active", deptA)).session(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("VIEWER"));
        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "ADMIN", "Active", deptA)).session(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(put("/api/users/" + memberA), userUpdate(memberAEmail, "MEMBER", "Active", deptB)).session(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(put("/api/users/" + memberB), userUpdate(memberBEmail, "MEMBER", "Active", deptB)).session(manager))
                .andExpect(status().isForbidden());

        mvc.perform(json(put("/api/departments/" + deptA), "{\"name\":\"" + unique("Alpha") + "\"}").session(manager))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/departments/" + deptB), "{\"name\":\"" + unique("Beta") + "\"}").session(manager))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Gamma") + "\"}").session(manager))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ users

    @Test
    void adminCanCreateUpdateDeactivateAndDeleteUsers() throws Exception {
        MockHttpSession admin = admin();
        String email = unique("crud") + "@example.com";
        long id = createUser(admin, email, "MEMBER", null);

        mvc.perform(json(put("/api/users/" + id), userUpdate(email, "MEMBER", "Inactive", null)).session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Inactive"));

        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(startsWith("This account is inactive")));

        mvc.perform(delete("/api/users/" + id).session(admin)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/users/" + id).session(admin)).andExpect(status().isNotFound());
    }

    @Test
    void deactivatedUserLosesTheirSessionImmediately() throws Exception {
        MockHttpSession admin = admin();
        String email = unique("kick") + "@example.com";
        long id = createUser(admin, email, "MEMBER", 1L);
        MockHttpSession member = login(email, PASSWORD);

        mvc.perform(get("/api/users").session(member)).andExpect(status().isOk());
        mvc.perform(json(put("/api/users/" + id), userUpdate(email, "MEMBER", "Inactive", 1L)).session(admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users").session(member)).andExpect(status().isUnauthorized());
    }

    @Test
    void theLastActiveAdminIsProtected() throws Exception {
        MockHttpSession admin = admin();
        mvc.perform(delete("/api/users/1").session(admin)).andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/users/1"), userUpdate(ADMIN_EMAIL, "MEMBER", "Active", null)).session(admin))
                .andExpect(status().isConflict());
        mvc.perform(json(put("/api/users/1"), userUpdate(ADMIN_EMAIL, "ADMIN", "Inactive", null)).session(admin))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changingOwnEmailKeepsTheSessionAndRequiresPassword() throws Exception {
        String email = unique("mail") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);
        MockHttpSession session = login(email, PASSWORD);
        String newEmail = unique("renamed") + "@example.com";

        mvc.perform(json(post("/api/auth/email"), "{\"email\":\"" + newEmail + "\",\"currentPassword\":\"wrong\"}")
                        .session(session))
                .andExpect(status().isBadRequest());

        mvc.perform(json(post("/api/auth/email"), "{\"email\":\"" + newEmail + "\",\"currentPassword\":\"" + PASSWORD + "\"}")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));
        mvc.perform(get("/api/users").session(session)).andExpect(status().isOk());
    }

    @Test
    void changingPasswordWorks() throws Exception {
        String email = unique("pw") + "@example.com";
        createUser(admin(), email, "MEMBER", 1L);
        MockHttpSession session = login(email, PASSWORD);

        mvc.perform(json(post("/api/auth/password"), "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"short\"}")
                        .session(session))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/auth/password"), "{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"Another#456\"}")
                        .session(session))
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
        MockHttpSession admin = admin();
        long dept = createDepartment(admin, unique("Temp"));
        String email = unique("dept") + "@example.com";
        long userId = createUser(admin, email, "MEMBER", dept);

        mvc.perform(delete("/api/departments/" + dept).session(admin)).andExpect(status().isNoContent());

        String users = mvc.perform(get("/api/users").session(admin)).andReturn().getResponse().getContentAsString();
        Object departmentId = JsonPath.read(users, "$[?(@.id == " + userId + ")].departmentId");
        assertThat(departmentId.toString()).isEqualTo("[null]");
    }

    @Test
    void departmentNamesAreValidatedAndUnique() throws Exception {
        MockHttpSession admin = admin();
        String name = unique("Unique");
        createDepartment(admin, name);
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name.toUpperCase() + "\"}").session(admin))
                .andExpect(status().isConflict());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"   \"}").session(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Bad") + "\",\"color\":\"red; x\"}").session(admin))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ connections, keys, settings

    @Test
    void apiKeySecretIsReturnedOnlyOnce() throws Exception {
        MockHttpSession admin = admin();
        MvcResult created = mvc.perform(json(post("/api/keys"), "{\"name\":\"CI key\"}").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.secret").value(startsWith("msk_")))
                .andReturn();
        String secret = JsonPath.read(created.getResponse().getContentAsString(), "$.secret");

        String list = mvc.perform(get("/api/keys").session(admin)).andReturn().getResponse().getContentAsString();
        assertThat(list).contains("CI key").doesNotContain(secret).doesNotContain("\"secret\"");
    }

    @Test
    void integrationsAndWebhooksValidateInput() throws Exception {
        MockHttpSession admin = admin();
        mvc.perform(get("/api/connections").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12));
        mvc.perform(post("/api/connections/not-a-service/connect").session(admin)).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"javascript:alert(1)\"}").session(admin))
                .andExpect(status().isBadRequest());

        MvcResult created = mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/hook\",\"events\":[\"*\"]}")
                        .session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active").value(true))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        mvc.perform(patch("/api/webhooks/" + id + "/toggle").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void settingsAreValidated() throws Exception {
        MockHttpSession admin = admin();
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"Mars/Olympus\"}").session(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/settings/orgTimezone"), "{\"value\":\"Europe/Bucharest\"}").session(admin))
                .andExpect(status().isOk());
        mvc.perform(get("/api/settings/orgTimezone").session(admin))
                .andExpect(jsonPath("$.value").value("Europe/Bucharest"));

        mvc.perform(json(put("/api/settings/worldClocks"),
                        "{\"value\":\"[{\\\"label\\\":\\\"Cluj\\\",\\\"tz\\\":\\\"Europe/Bucharest\\\"}]\"}").session(admin))
                .andExpect(status().isOk());
        mvc.perform(json(put("/api/settings/worldClocks"), "{\"value\":\"not json\"}").session(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/settings/somethingElse"), "{\"value\":\"x\"}").session(admin))
                .andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ typed request bodies

    @Test
    void apiKeyBodyAndNameAreOptional() throws Exception {
        MockHttpSession admin = admin();
        // No body at all, an empty object and a blank name all get the default name.
        mvc.perform(post("/api/keys").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{}").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{\"name\":\"   \"}").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("API key"));
        mvc.perform(json(post("/api/keys"), "{\"name\":\"" + "k".repeat(61) + "\"}").session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Key name must be at most 60 characters"));
    }

    @Test
    void webhookEventsDefaultToEverything() throws Exception {
        MockHttpSession admin = admin();
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/no-events\"}").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("*"));
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/empty\",\"events\":[]}").session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("*"));
        mvc.perform(json(post("/api/webhooks"),
                        "{\"url\":\"https://example.com/list\",\"events\":[\"user.created\",\" user.deleted \",\"user.created\"]}")
                        .session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("user.created,user.deleted"));
        // The comma-separated string accepted by the untyped body still works.
        mvc.perform(json(post("/api/webhooks"),
                        "{\"url\":\"https://example.com/string\",\"events\":\"user.created, dept.deleted\"}")
                        .session(admin))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.events").value("user.created,dept.deleted"));
        mvc.perform(json(post("/api/webhooks"), "{\"url\":\"https://example.com/bad\",\"events\":[\"Bad Event\"]}")
                        .session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid event name: Bad Event"));
        mvc.perform(json(post("/api/webhooks"), "{\"events\":[\"*\"]}").session(admin))
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

        MockHttpSession admin = admin();
        mvc.perform(json(post("/api/auth/password"), "{\"newPassword\":\"Whatever#123\"}").session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));
        mvc.perform(json(put("/api/settings/orgTimezone"), "{}").session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Timezone is required"));
        mvc.perform(json(post("/api/audit/event"), "{}").session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unsupported event type"));

        // A missing description falls back to the default text.
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"export_generated\"}").session(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/audit").param("limit", "1").session(admin))
                .andExpect(jsonPath("$[0].eventType").value("export_generated"))
                .andExpect(jsonPath("$[0].description").value("Exported data"));
    }

    @Test
    void malformedBodiesGiveA400JsonError() throws Exception {
        MockHttpSession admin = admin();
        String[][] requests = {
                {"/api/auth/forgot-password", "{not json"},
                {"/api/auth/reset-password", "[1, 2]"},
                {"/api/auth/email", "{\"email\":{\"nested\":true}}"},
                {"/api/webhooks", "{\"url\":\"https://example.com/x\",\"events\":{\"a\":1}}"},
                {"/api/keys", "{\"name\":"},
        };
        for (String[] request : requests) {
            mvc.perform(json(post(request[0]), request[1]).session(admin))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Bad Request"))
                    .andExpect(jsonPath("$.message").value("Malformed request body"));
        }
        mvc.perform(json(put("/api/settings/worldClocks"), "{\"value\":[{\"label\":\"Cluj\"}]}").session(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request body"));
    }

    // ------------------------------------------------------------------ import, database, audit

    @Test
    void importCreatesValidRowsAndReportsTheRest() throws Exception {
        MockHttpSession admin = admin();
        String a = unique("imp") + "@example.com";
        String b = unique("imp") + "@example.com";
        String body = "{\"rows\":["
                + "{\"fullName\":\"Ana Pop\",\"email\":\"" + a + "\",\"role\":\"MEMBER\",\"status\":\"active\",\"department\":\"development\"},"
                + "{\"fullName\":\"Ion Pop\",\"email\":\"" + b + "\",\"role\":\"viewer\",\"status\":\"\",\"department\":\"\"},"
                + "{\"fullName\":\"Bad Mail\",\"email\":\"not-an-email\"},"
                + "{\"fullName\":\"Dup\",\"email\":\"" + a + "\"},"
                + "{\"fullName\":\"No Dept\",\"email\":\"" + unique("x") + "@example.com\",\"department\":\"Nowhere\"}"
                + "]}";

        mvc.perform(json(post("/api/import/users"), body).session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.skipped").value(3))
                .andExpect(jsonPath("$.errors[0].row").value(3));

        mvc.perform(json(post("/api/import/departments"),
                        "{\"rows\":[{\"name\":\"" + unique("Imported") + "\",\"color\":\"avatar-rose\"},{\"name\":\"Development\"}]}")
                        .session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.skipped").value(1));
    }

    @Test
    void databasePageListsRealTables() throws Exception {
        mvc.perform(get("/api/database/tables").session(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name").value(hasItem("users")))
                .andExpect(jsonPath("$[*].name").value(hasItem("departments")))
                .andExpect(jsonPath("$[0].columns[*].name").value(hasItem("email")));
    }

    @Test
    void exportEventsCanBeLoggedByPermittedUsers() throws Exception {
        MockHttpSession admin = admin();
        mvc.perform(json(post("/api/audit/event"), "{\"eventType\":\"export_generated\",\"description\":\"Exported users CSV\"}")
                        .session(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/audit").param("limit", "5").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].eventType").value(hasItem("export_generated")))
                .andExpect(jsonPath("$[0].createdAt").value(not(org.hamcrest.Matchers.emptyOrNullString())));
    }
}
