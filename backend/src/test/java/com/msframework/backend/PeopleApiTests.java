package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.config.DemoPeopleSeeder;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * People management: user search and profiles, bulk changes, department managers and members,
 * access requests, roles, admin reset links and the demo people seeder.
 */
@IntegrationTest
class PeopleApiTests {

    private static final String ADMIN_EMAIL = "admin@test.com";
    private static final String ADMIN_PASSWORD = "password123";
    private static final String PASSWORD = "Secret#123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private DemoPeopleSeeder demoPeopleSeeder;

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

    private static long id(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createDepartment(TestSession admin, String name) throws Exception {
        return id(mvc.perform(json(post("/api/departments"), "{\"name\":\"" + name + "\"}").with(admin))
                .andExpect(status().isCreated()).andReturn());
    }

    private long createUser(TestSession admin, String name, String email, String role, String status,
                            Long departmentId, String title) throws Exception {
        String body = "{\"fullName\":\"" + name + "\",\"email\":\"" + email + "\",\"role\":\"" + role + "\","
                + "\"status\":\"" + status + "\",\"password\":\"" + PASSWORD + "\",\"departmentId\":" + departmentId
                + ",\"title\":" + (title == null ? "null" : "\"" + title + "\"") + "}";
        return id(mvc.perform(json(post("/api/users"), body).with(admin)).andExpect(status().isCreated()).andReturn());
    }

    private long createUser(TestSession admin, String email, String role, Long departmentId) throws Exception {
        return createUser(admin, "Test User", email, role, "Active", departmentId, null);
    }

    private static String email(String prefix) {
        return unique(prefix) + "@example.com";
    }

    private String register(String email, long departmentId) throws Exception {
        return mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Riley Request\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email + "\",\"departmentId\":" + departmentId + ",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
    }

    private long pendingRequestId(TestSession admin, String email) throws Exception {
        String body = mvc.perform(get("/api/access-requests").param("status", "PENDING").with(admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Number> ids = JsonPath.read(body, "$[?(@.email == '" + email + "')].id");
        assertThat(ids).hasSize(1);
        return ids.getFirst().longValue();
    }

    // ------------------------------------------------------------------ search

    @Test
    void searchFiltersSortsAndPages() throws Exception {
        TestSession admin = admin();
        String tag = unique("srch");
        long dept = createDepartment(admin, unique("Search"));
        long zed = createUser(admin, "Zed " + tag, email("zed"), "MEMBER", "Active", dept, "Sound Designer");
        long amy = createUser(admin, "Amy " + tag, email("amy"), "VIEWER", "Inactive", dept, null);
        long bob = createUser(admin, "Bob " + tag, email("bob"), "MEMBER", "Active", dept, "Producer " + tag);

        mvc.perform(get("/api/users/search").param("q", tag.toUpperCase()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[*].id").value(contains((int) amy, (int) bob, (int) zed)))
                .andExpect(jsonPath("$.items[0].title").value(nullValue()))
                .andExpect(jsonPath("$.items[0].managerOf").value(nullValue()))
                .andExpect(jsonPath("$.items[2].title").value("Sound Designer"));

        mvc.perform(get("/api/users/search").param("departmentId", String.valueOf(dept)).param("sort", "-name")
                        .with(admin))
                .andExpect(jsonPath("$.items[*].id").value(contains((int) zed, (int) bob, (int) amy)));
        mvc.perform(get("/api/users/search").param("departmentId", String.valueOf(dept)).param("role", "viewer")
                        .with(admin))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(amy));
        mvc.perform(get("/api/users/search").param("departmentId", String.valueOf(dept)).param("status", "Active")
                        .param("sort", "email").with(admin))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[*].id").value(contains((int) bob, (int) zed)));
        // A % in the search text is literal, not a wildcard.
        mvc.perform(get("/api/users/search").param("q", tag + "%").with(admin))
                .andExpect(jsonPath("$.total").value(0));

        mvc.perform(get("/api/users/search").param("q", tag).param("size", "2").with(admin))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/users/search").param("q", tag).param("size", "2").param("page", "1").with(admin))
                .andExpect(jsonPath("$.items[*].id").value(contains((int) zed)))
                .andExpect(jsonPath("$.page").value(1));

        mvc.perform(get("/api/users/search").param("size", "1000").with(admin))
                .andExpect(jsonPath("$.size").value(100));
        mvc.perform(get("/api/users/search").param("sort", "password").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/users/search").param("role", "OWNER").with(admin))
                .andExpect(status().isBadRequest());

        // The old unpaged list still works and carries the new fields.
        mvc.perform(get("/api/users").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + zed + ")].title").value(hasItem("Sound Designer")));
    }

    @Test
    void userListsDoNotQueryOncePerUser() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Batch"));
        for (int i = 0; i < 12; i++) {
            createUser(admin, email("batch"), i % 2 == 0 ? "MEMBER" : "VIEWER", dept);
        }
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();

        statistics.clear();
        mvc.perform(get("/api/users/search").param("size", "100").with(admin)).andExpect(status().isOk());
        assertThat(statistics.getPrepareStatementCount()).as("statements for one page of users").isLessThan(15);

        statistics.clear();
        mvc.perform(get("/api/users").with(admin)).andExpect(status().isOk());
        long users = jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class);
        assertThat(statistics.getPrepareStatementCount()).as("statements for %d users", users)
                .isLessThan(15 + users / 100 * 3);
    }

    // ------------------------------------------------------------------ profile and activity

    @Test
    void profileShowsDetailsAndActivityIsKeysetPaged() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Profile"));
        String email = email("profile");
        long id = createUser(admin, "Pat Profile", email, "MEMBER", "Active", dept, "Animator");

        mvc.perform(get("/api/users/" + id).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Animator"))
                .andExpect(jsonPath("$.departmentId").value(dept))
                .andExpect(jsonPath("$.lastLoginAt").value(nullValue()))
                .andExpect(jsonPath("$.permissions").value(hasItem("USER_READ")))
                .andExpect(jsonPath("$.canEdit").value(true))
                .andExpect(jsonPath("$.password").doesNotExist());

        TestSession member = login(email, PASSWORD);
        mvc.perform(json(put("/api/users/" + id), "{\"fullName\":\"Pat Profile\",\"email\":\"" + email + "\","
                        + "\"role\":\"MEMBER\",\"status\":\"Active\",\"departmentId\":" + dept + ",\"title\":\"Lead Animator\"}")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Lead Animator"))
                .andExpect(jsonPath("$.lastLoginAt").value(notNullValue()));

        // A member can read profiles but not edit them, and cannot read the audit trail.
        mvc.perform(get("/api/users/" + id).with(member)).andExpect(jsonPath("$.canEdit").value(false));
        mvc.perform(get("/api/users/" + id + "/activity").with(member)).andExpect(status().isForbidden());

        String first = mvc.perform(get("/api/users/" + id + "/activity").param("limit", "2").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].eventType").value("user_updated"))
                .andExpect(jsonPath("$.items[0].subjectUserId").value(id))
                .andExpect(jsonPath("$.items[1].eventType").value("user_login"))
                .andExpect(jsonPath("$.nextCursor").value(notNullValue()))
                .andReturn().getResponse().getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(get("/api/users/" + id + "/activity").param("cursor", cursor).with(admin))
                .andExpect(jsonPath("$.items[*].eventType").value(contains("user_created")))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(get("/api/users/" + id + "/activity").param("cursor", "not-a-cursor").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/users/999999").with(admin)).andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ bulk

    @Test
    void bulkActionsApplyEveryRulePerUser() throws Exception {
        TestSession admin = admin();
        // Other tests (and the demo seeder test) must not leave extra active admins behind this point.
        jdbc.update("UPDATE users SET status = 'Inactive' WHERE id <> 1 AND id IN (SELECT ur.user_id FROM user_roles ur "
                + "JOIN role r ON r.id = ur.role_id WHERE r.name = 'ADMIN')");
        long secondAdmin = createUser(admin, email("admin2"), "ADMIN", null);

        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + secondAdmin + ",1],\"action\":\"SET_ROLE\","
                        + "\"role\":\"MEMBER\"}").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.succeeded").value(1))
                .andExpect(jsonPath("$.failed").value(1))
                .andExpect(jsonPath("$.results[0].ok").value(true))
                .andExpect(jsonPath("$.results[0].user.roles[0]").value("MEMBER"))
                .andExpect(jsonPath("$.results[1].ok").value(false))
                .andExpect(jsonPath("$.results[1].error").value("At least one active admin is required"));

        long deptA = createDepartment(admin, unique("BulkA"));
        long deptB = createDepartment(admin, unique("BulkB"));
        String managerEmail = email("bulkmgr");
        createUser(admin, managerEmail, "MANAGER", deptA);
        long inA = createUser(admin, email("bulka"), "MEMBER", deptA);
        long inB = createUser(admin, email("bulkb"), "MEMBER", deptB);

        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + ",1,999999,"  + inA + "],"
                        + "\"action\":\"DEACTIVATE\"}").with(admin))
                .andExpect(jsonPath("$.results", hasSize(3)))
                .andExpect(jsonPath("$.results[0].user.status").value("Inactive"))
                .andExpect(jsonPath("$.results[1].error").value("You cannot deactivate your own account"))
                .andExpect(jsonPath("$.results[2].error").value("User not found"));
        mvc.perform(get("/api/users/" + inA + "/activity").with(admin))
                .andExpect(jsonPath("$.items[0].eventType").value("user_updated"))
                .andExpect(jsonPath("$.items[0].description").value(containsString("status Active → Inactive")));

        TestSession manager = login(managerEmail, PASSWORD);
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "," + inB + "],\"action\":\"ACTIVATE\"}")
                        .with(manager))
                .andExpect(jsonPath("$.results[0].ok").value(true))
                .andExpect(jsonPath("$.results[1].error").value("Managers can only edit users in their own department"));
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "],\"action\":\"SET_DEPARTMENT\","
                        + "\"departmentId\":" + deptB + "}").with(manager))
                .andExpect(jsonPath("$.results[0].error").value("Managers cannot move users out of their department"));
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "],\"action\":\"SET_ROLE\",\"role\":\"ADMIN\"}")
                        .with(manager))
                .andExpect(jsonPath("$.results[0].ok").value(false));
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "],\"action\":\"SET_DEPARTMENT\","
                        + "\"departmentId\":" + deptB + "}").with(admin))
                .andExpect(jsonPath("$.results[0].user.departmentId").value(deptB));

        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "],\"action\":\"SET_ROLE\"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[],\"action\":\"ACTIVATE\"}").with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + inA + "],\"action\":\"EXPLODE\"}").with(admin))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ departments

    @Test
    void departmentManagersMustBeActiveManagersOfTheDepartment() throws Exception {
        TestSession admin = admin();
        long deptA = createDepartment(admin, unique("MgrA"));
        long deptB = createDepartment(admin, unique("MgrB"));
        String bossEmail = email("boss");
        long boss = createUser(admin, "Bea Boss", bossEmail, "MANAGER", "Active", deptA, null);
        long member = createUser(admin, email("plain"), "MEMBER", deptA);
        long outsider = createUser(admin, email("outsider"), "MANAGER", deptB);
        long inactive = createUser(admin, "Ina Active", email("inactive"), "MANAGER", "Inactive", deptA, null);

        mvc.perform(json(put("/api/departments/" + deptA + "/manager"), "{\"userId\":" + member + "}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("MANAGER role")));
        mvc.perform(json(put("/api/departments/" + deptA + "/manager"), "{\"userId\":" + outsider + "}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("is not a member of")));
        mvc.perform(json(put("/api/departments/" + deptA + "/manager"), "{\"userId\":" + inactive + "}").with(admin))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("inactive")));
        TestSession bossSession = login(bossEmail, PASSWORD);
        mvc.perform(json(put("/api/departments/" + deptA + "/manager"), "{\"userId\":" + boss + "}").with(bossSession))
                .andExpect(status().isForbidden());

        mvc.perform(json(put("/api/departments/" + deptA + "/manager"), "{\"userId\":" + boss + "}").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(boss))
                .andExpect(jsonPath("$.managerName").value("Bea Boss"))
                .andExpect(jsonPath("$.memberCount").value(3));

        mvc.perform(get("/api/departments").with(admin))
                .andExpect(jsonPath("$[?(@.id == " + deptA + ")].managerName").value(hasItem("Bea Boss")));
        mvc.perform(get("/api/departments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + deptA + ")].managerName").value(not(hasItem("Bea Boss"))));
        mvc.perform(get("/api/users/" + boss).with(admin))
                .andExpect(jsonPath("$.managerOf").value(deptA))
                .andExpect(jsonPath("$.departmentManagerName").value("Bea Boss"));
        mvc.perform(get("/api/departments/" + deptA).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(boss))
                .andExpect(jsonPath("$.activeMemberCount").value(2))
                .andExpect(jsonPath("$.members", hasSize(3)))
                .andExpect(jsonPath("$.members[?(@.id == " + boss + ")].managerOf").value(hasItem((int) deptA)));
        mvc.perform(get("/api/departments/" + deptA + "/activity").with(admin))
                .andExpect(jsonPath("$.items[0].eventType").value("dept_manager_changed"));

        // Moving the manager to another department clears the manager of the old one.
        mvc.perform(post("/api/departments/" + deptB + "/members/" + boss).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.departmentId").value(deptB))
                .andExpect(jsonPath("$.managerOf").value(nullValue()));
        mvc.perform(get("/api/departments/" + deptA).with(admin))
                .andExpect(jsonPath("$.managerId").value(nullValue()));

        // Members: removing keeps the user; removing a non-member is refused; managers cannot move people.
        mvc.perform(delete("/api/departments/" + deptA + "/members/" + member).with(admin))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/users/" + member).with(admin)).andExpect(jsonPath("$.departmentId").value(nullValue()));
        mvc.perform(delete("/api/departments/" + deptA + "/members/" + member).with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/departments/" + deptA + "/members/" + member).with(bossSession))
                .andExpect(status().isForbidden());

        // Clearing works, and an unknown department is a 404.
        mvc.perform(json(put("/api/departments/" + deptB + "/manager"), "{\"userId\":null}").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(nullValue()));
        mvc.perform(get("/api/departments/999999").with(admin)).andExpect(status().isNotFound());
    }

    @Test
    void deactivatingOrDemotingAManagerClearsTheDepartmentManager() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Clear"));
        String bossEmail = email("clearboss");
        long boss = createUser(admin, "Cleo Boss", bossEmail, "MANAGER", "Active", dept, null);
        mvc.perform(json(put("/api/departments/" + dept + "/manager"), "{\"userId\":" + boss + "}").with(admin))
                .andExpect(status().isOk());

        mvc.perform(json(post("/api/users/bulk"), "{\"ids\":[" + boss + "],\"action\":\"SET_ROLE\",\"role\":\"MEMBER\"}")
                        .with(admin))
                .andExpect(jsonPath("$.results[0].user.managerOf").value(nullValue()));
        mvc.perform(get("/api/departments/" + dept).with(admin)).andExpect(jsonPath("$.managerId").value(nullValue()));
    }

    // ------------------------------------------------------------------ access requests

    @Test
    void registeringCreatesARequestThatAnAdminApproves() throws Exception {
        TestSession admin = admin();
        long dept = createDepartment(admin, unique("Requests"));
        String email = email("applicant");
        assertThat(register(email, dept)).contains("An administrator will review it");

        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(containsString("still waiting for approval")));
        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"Wrong#123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));

        String member = email("nosy");
        createUser(admin, member, "MEMBER", dept);
        mvc.perform(get("/api/access-requests").with(login(member, PASSWORD))).andExpect(status().isForbidden());

        long requestId = pendingRequestId(admin, email);
        mvc.perform(get("/api/access-requests").param("status", "PENDING").with(admin))
                .andExpect(jsonPath("$[?(@.id == " + requestId + ")].departmentId").value(hasItem((int) dept)))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist());
        mvc.perform(get("/api/access-requests").param("status", "LOST").with(admin))
                .andExpect(status().isBadRequest());

        mvc.perform(json(post("/api/access-requests/" + requestId + "/approve"), "{\"role\":\"VIEWER\"}").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.decidedBy").value(ADMIN_EMAIL))
                .andExpect(jsonPath("$.userId").value(notNullValue()));
        mvc.perform(json(post("/api/access-requests/" + requestId + "/approve"), "{}").with(admin))
                .andExpect(status().isConflict());

        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("VIEWER"))
                .andExpect(jsonPath("$.departmentId").value(dept));
        mvc.perform(json(post("/api/auth/register"), "{\"fullName\":\"Riley Request\",\"phone\":\"0712345678\","
                        + "\"email\":\"" + email + "\",\"departmentId\":" + dept + ",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("already exists")));

        mvc.perform(get("/api/audit").param("limit", "50").with(admin))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("access_requested")))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("access_approved")))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("login_pending")));
    }

    @Test
    void rejectedRequestsKeepTheNoteAndCanBeResubmitted() throws Exception {
        TestSession admin = admin();
        String email = email("rejected");
        register(email, 1);
        long requestId = pendingRequestId(admin, email);

        mvc.perform(json(post("/api/access-requests/" + requestId + "/reject"), "{\"note\":\"" + "y".repeat(501) + "\"}")
                        .with(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/access-requests/" + requestId + "/reject"), "{\"note\":\"Not an employee\"}")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.note").value("Not an employee"));
        mvc.perform(json(post("/api/access-requests/" + requestId + "/approve"), "{}").with(admin))
                .andExpect(status().isConflict());

        mvc.perform(json(post("/api/auth/login"), "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/access-requests").param("status", "REJECTED").with(admin))
                .andExpect(jsonPath("$[*].id").value(hasItem((int) requestId)));

        register(email, 1);
        mvc.perform(post("/api/access-requests/999999/reject").with(admin)).andExpect(status().isNotFound());
    }

    // ------------------------------------------------------------------ roles

    @Test
    void rolesListPermissionsAndMemberCounts() throws Exception {
        TestSession admin = admin();
        mvc.perform(get("/api/roles").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name").value(contains("ADMIN", "MANAGER", "MEMBER", "VIEWER")))
                .andExpect(jsonPath("$[0].permissions").value(hasItem("ACCESS_REQUESTS_MANAGE")))
                .andExpect(jsonPath("$[0].builtIn").value(true))
                .andExpect(jsonPath("$[1].permissions").value(hasItem("ROLES_READ")))
                .andExpect(jsonPath("$[1].permissions").value(not(hasItem("ACCESS_REQUESTS_MANAGE"))))
                .andExpect(jsonPath("$[2].permissions").value(not(hasItem("ROLES_READ"))));
        Integer admins = JsonPath.read(mvc.perform(get("/api/roles").with(admin)).andReturn().getResponse()
                .getContentAsString(), "$[0].activeMemberCount");
        assertThat(admins).isGreaterThanOrEqualTo(1);

        String memberEmail = email("rolemember");
        createUser(admin, memberEmail, "MEMBER", 1L);
        mvc.perform(get("/api/roles").with(login(memberEmail, PASSWORD))).andExpect(status().isForbidden());
        String managerEmail = email("rolemanager");
        createUser(admin, managerEmail, "MANAGER", 1L);
        mvc.perform(get("/api/roles").with(login(managerEmail, PASSWORD))).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ admin reset link

    @Test
    void adminsAndManagersCanMakeResetLinksWithinTheirScope() throws Exception {
        TestSession admin = admin();
        long deptA = createDepartment(admin, unique("ResetA"));
        long deptB = createDepartment(admin, unique("ResetB"));
        String targetEmail = email("forgetful");
        long target = createUser(admin, targetEmail, "MEMBER", deptA);

        String body = mvc.perform(post("/api/users/" + target + "/password-reset").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.link").value(containsString("/reset-password?token=")))
                .andExpect(jsonPath("$.expiresAt").value(notNullValue()))
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(body, "$.link");
        String token = link.substring(link.indexOf("token=") + "token=".length());
        mvc.perform(json(post("/api/auth/reset-password"), "{\"token\":\"" + token + "\",\"newPassword\":\"Handed#456\"}"))
                .andExpect(status().isNoContent());
        login(targetEmail, "Handed#456");
        mvc.perform(get("/api/users/" + target + "/activity").with(admin))
                .andExpect(jsonPath("$.items[*].eventType").value(hasItem("password_reset_link_created")));

        String managerEmail = email("resetmgr");
        createUser(admin, managerEmail, "MANAGER", deptA);
        long other = createUser(admin, email("otherdept"), "MEMBER", deptB);
        long sleeper = createUser(admin, "Sleepy", email("sleeper"), "MEMBER", "Inactive", deptA, null);
        TestSession manager = login(managerEmail, PASSWORD);
        mvc.perform(post("/api/users/" + target + "/password-reset").with(manager)).andExpect(status().isOk());
        mvc.perform(post("/api/users/" + other + "/password-reset").with(manager)).andExpect(status().isForbidden());
        mvc.perform(post("/api/users/1/password-reset").with(manager)).andExpect(status().isForbidden());
        mvc.perform(post("/api/users/" + sleeper + "/password-reset").with(admin)).andExpect(status().isConflict());
        mvc.perform(post("/api/users/" + other + "/password-reset").with(login(targetEmail, "Handed#456")))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ demo data

    @Test
    void demoSeederAddsPeopleOnceAndLeavesTheAdminAlone() throws Exception {
        String adminBefore = jdbc.queryForObject("SELECT email || password || status || coalesce(full_name, '') "
                + "FROM users WHERE id = 1", String.class);
        try {
            DemoPeopleSeeder.Summary first = demoPeopleSeeder.seed();
            assertThat(first.seeded()).isTrue();
            assertThat(first.usersCreated()).isEqualTo(45);
            assertThat(first.managersAssigned()).isEqualTo(5);
            assertThat(first.accessRequestsCreated()).isEqualTo(9);
            assertThat(first.auditEventsCreated()).isBetween(250, 400);

            String demo = "u.email LIKE '%@mehstudios.net'";
            assertThat(count("SELECT COUNT(*) FROM users u WHERE " + demo)).isEqualTo(45);
            assertThat(count("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN role r "
                    + "ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND " + demo)).isEqualTo(2);
            assertThat(count("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN role r "
                    + "ON r.id = ur.role_id WHERE r.name = 'MANAGER' AND " + demo)).isEqualTo(6);
            assertThat(count("SELECT COUNT(*) FROM users u WHERE status = 'Inactive' AND " + demo)).isBetween(2L, 6L);
            assertThat(count("SELECT COUNT(*) FROM users u WHERE last_login_at IS NULL AND " + demo)).isZero();
            assertThat(count("SELECT COUNT(*) FROM departments d JOIN users u ON u.id = d.manager_id WHERE "
                    + "d.id = u.department_id AND " + demo)).isEqualTo(5);
            assertThat(count("SELECT COUNT(*) FROM access_requests WHERE status = 'PENDING' "
                    + "AND email LIKE '%@mehstudios.net'")).isEqualTo(6);
            assertThat(count("SELECT COUNT(*) FROM audit_events WHERE created_at > now() - interval '61 days' "
                    + "AND created_at < now() AND actor_email LIKE '%@mehstudios.net'")).isGreaterThan(200);

            long users = count("SELECT COUNT(*) FROM users");
            long events = count("SELECT COUNT(*) FROM audit_events");
            DemoPeopleSeeder.Summary second = demoPeopleSeeder.seed();
            assertThat(second.seeded()).isFalse();
            assertThat(count("SELECT COUNT(*) FROM users")).isEqualTo(users);
            assertThat(count("SELECT COUNT(*) FROM audit_events")).isEqualTo(events);

            // Without the marker (as if a second seeder version ran), nobody is added twice.
            jdbc.update("DELETE FROM org_settings WHERE key = ?", DemoPeopleSeeder.MARKER);
            DemoPeopleSeeder.Summary again = demoPeopleSeeder.seed();
            assertThat(again.usersCreated()).isZero();
            assertThat(again.accessRequestsCreated()).isZero();
            assertThat(again.auditEventsCreated()).isZero();
            assertThat(count("SELECT COUNT(*) FROM users")).isEqualTo(users);
            assertThat(count("SELECT COUNT(*) FROM audit_events")).isEqualTo(events);

            assertThat(jdbc.queryForObject("SELECT email || password || status || coalesce(full_name, '') "
                    + "FROM users WHERE id = 1", String.class)).isEqualTo(adminBefore);

            // Demo users sign in with the documented password.
            login("radu.constantinescu@mehstudios.net", DemoPeopleSeeder.DEMO_PASSWORD);
        } finally {
            // Keep admin@test.com the only active admin for the last-admin tests.
            jdbc.update("UPDATE users SET status = 'Inactive' WHERE email IN (?, ?)",
                    "andreea.popescu@mehstudios.net", "mihai.ionescu@mehstudios.net");
        }
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0 : value;
    }
}
