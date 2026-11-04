package com.msframework.backend;

import com.jayway.jsonpath.JsonPath;
import com.msframework.backend.config.DemoBusinessSeeder;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.service.FiscalPeriods;
import com.msframework.backend.service.GoalService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Budgets, expenses and their approval workflow, goals and performance, reports, the business CSV
 * imports, the API-key ingest and the demo business seeder. Every test works in its own new
 * departments, so the shared database (and the demo data, once seeded) never changes its sums.
 */
@IntegrationTest
class BusinessApiTests {

    private static final String PASSWORD = "Secret#123";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private DemoBusinessSeeder demoSeeder;

    @Autowired
    private JdbcTemplate jdbc;

    private final FiscalPeriods.Quarter quarter = FiscalPeriods.current();
    /** A date inside the current quarter that is never in the future. */
    private final LocalDate day = quarter.start();

    // ------------------------------------------------------------------ helpers

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder builder, String body) {
        return builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static long id(MvcResult result) throws Exception {
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).longValue();
    }

    private MockHttpSession login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(json(post("/api/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private MockHttpSession admin() throws Exception {
        return login("admin@test.com", "password123");
    }

    private long department(MockHttpSession admin) throws Exception {
        return id(mvc.perform(json(post("/api/departments"), "{\"name\":\"" + unique("Biz") + "\"}").session(admin))
                .andExpect(status().isCreated()).andReturn());
    }

    /** Creates a user and returns a signed-in session for them. */
    private MockHttpSession user(MockHttpSession admin, String role, long departmentId) throws Exception {
        String email = unique(role.toLowerCase()) + "@example.com";
        mvc.perform(json(post("/api/users"), "{\"fullName\":\"Biz " + role + "\",\"email\":\"" + email + "\",\"role\":\""
                        + role + "\",\"status\":\"Active\",\"password\":\"" + PASSWORD + "\",\"departmentId\":"
                        + departmentId + "}").session(admin))
                .andExpect(status().isCreated());
        return login(email, PASSWORD);
    }

    private long category(MockHttpSession session, String name) throws Exception {
        String body = mvc.perform(get("/api/finance/categories").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Number> ids = JsonPath.read(body, "$[?(@.name == '" + name + "')].id");
        return ids.getFirst().longValue();
    }

    private void budget(MockHttpSession admin, long departmentId, long categoryId, String amount) throws Exception {
        mvc.perform(json(post("/api/budgets"), "{\"departmentId\":" + departmentId + ",\"categoryId\":" + categoryId
                        + ",\"year\":" + quarter.year() + ",\"quarter\":" + quarter.quarter() + ",\"amount\":" + amount + "}")
                        .session(admin))
                .andExpect(status().isCreated());
    }

    private ResultActions expense(MockHttpSession session, Long departmentId, long categoryId, String amount,
                                  boolean submit) throws Exception {
        return mvc.perform(json(post("/api/expenses"), "{" + (departmentId == null ? "" : "\"departmentId\":" + departmentId + ",")
                + "\"categoryId\":" + categoryId + ",\"amount\":" + amount + ",\"date\":\"" + day + "\","
                + "\"vendor\":\"JetBrains\",\"description\":\"Licences\",\"submit\":" + submit + "}").session(session));
    }

    private long submitted(MockHttpSession session, long departmentId, long categoryId, String amount) throws Exception {
        return id(expense(session, departmentId, categoryId, amount, true)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andReturn());
    }

    private long goal(MockHttpSession session, long departmentId, String direction, String baseline, String target,
                      int weight) throws Exception {
        return id(mvc.perform(json(post("/api/goals"), "{\"departmentId\":" + departmentId + ",\"name\":\"" + unique("KPI")
                        + "\",\"unit\":\"%\",\"direction\":\"" + direction + "\",\"baseline\":" + baseline + ",\"target\":"
                        + target + ",\"weight\":" + weight + ",\"year\":" + quarter.year() + ",\"quarter\":"
                        + quarter.quarter() + "}").session(session))
                .andExpect(status().isCreated()).andReturn());
    }

    private ResultActions checkin(MockHttpSession session, long goalId, String value) throws Exception {
        return mvc.perform(json(post("/api/goals/" + goalId + "/checkins"),
                "{\"date\":\"" + day + "\",\"value\":" + value + "}").session(session));
    }

    // ------------------------------------------------------------------ budgets

    @Test
    void budgetRemainingIsBudgetMinusSpentAndCommitted() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long travel = category(admin, "Travel");
        budget(admin, dept, travel, "1000.00");
        MockHttpSession member = user(admin, "MEMBER", dept);
        MockHttpSession manager = user(admin, "MANAGER", dept);

        submitted(member, dept, travel, "200.00");                       // committed
        long approved = submitted(member, dept, travel, "300.00");       // spent
        mvc.perform(post("/api/expenses/" + approved + "/approve").session(manager)).andExpect(status().isOk());
        long paid = submitted(member, dept, travel, "100.00");           // spent
        mvc.perform(post("/api/expenses/" + paid + "/approve").session(manager)).andExpect(status().isOk());
        mvc.perform(json(post("/api/expenses/" + paid + "/pay"), "{\"paymentReference\":\"TRF-1\"}").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"));
        expense(member, dept, travel, "50.00", false).andExpect(status().isCreated());   // draft: not counted
        long rejected = submitted(member, dept, travel, "70.00");        // rejected: not counted
        mvc.perform(json(post("/api/expenses/" + rejected + "/reject"), "{\"note\":\"Not planned\"}").session(manager))
                .andExpect(status().isOk());

        mvc.perform(get("/api/budgets").param("year", "" + quarter.year()).param("quarter", "" + quarter.quarter())
                        .param("departmentId", "" + dept).session(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.lines", hasSize(1)))
                .andExpect(jsonPath("$.lines[0].amount").value(1000.0))
                .andExpect(jsonPath("$.lines[0].spent").value(400.0))
                .andExpect(jsonPath("$.lines[0].committed").value(200.0))
                .andExpect(jsonPath("$.lines[0].remaining").value(400.0))
                .andExpect(jsonPath("$.totals.remaining").value(400.0));

        // Members cannot read budgets, and nobody but finance can set them.
        mvc.perform(get("/api/budgets").session(member)).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/budgets"), "{\"departmentId\":" + dept + ",\"categoryId\":" + travel
                        + ",\"year\":" + quarter.year() + ",\"quarter\":" + quarter.quarter() + ",\"amount\":5}")
                        .session(manager))
                .andExpect(status().isForbidden());
        // One line per department, category and quarter.
        mvc.perform(json(post("/api/budgets"), "{\"departmentId\":" + dept + ",\"categoryId\":" + travel
                        + ",\"year\":" + quarter.year() + ",\"quarter\":" + quarter.quarter() + ",\"amount\":5}")
                        .session(admin))
                .andExpect(status().isConflict());
    }

    @Test
    void spendingWithoutABudgetLineShowsUpWithAZeroBudget() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long hardware = category(admin, "Hardware");
        MockHttpSession member = user(admin, "MEMBER", dept);
        expense(member, dept, hardware, "80.00", true)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.overBudget").value(true));

        mvc.perform(get("/api/budgets").param("departmentId", "" + dept).session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0].id").doesNotExist())
                .andExpect(jsonPath("$.lines[0].amount").value(0.0))
                .andExpect(jsonPath("$.lines[0].committed").value(80.0))
                .andExpect(jsonPath("$.lines[0].remaining").value(-80.0));
    }

    @Test
    void submittingOverTheRemainingBudgetIsAllowedButFlagged() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long software = category(admin, "Software & licences");
        budget(admin, dept, software, "100.00");
        MockHttpSession member = user(admin, "MEMBER", dept);

        expense(member, dept, software, "60.00", true)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.overBudget").value(false));
        // 40 left: 50 goes over, and is still submitted.
        long over = id(expense(member, dept, software, "50.00", true)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.overBudget").value(true))
                .andReturn());
        // Editing it down to what is left clears the flag.
        mvc.perform(json(put("/api/expenses/" + over), "{\"departmentId\":" + dept + ",\"categoryId\":" + software
                        + ",\"amount\":40,\"date\":\"" + day + "\",\"vendor\":\"JetBrains\"}").session(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.overBudget").value(false));
    }

    // ------------------------------------------------------------------ expense workflow

    @Test
    void expenseWorkflowEnforcesScopeAndForbidsSelfApproval() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long otherDept = department(admin);
        long training = category(admin, "Training");
        MockHttpSession member = user(admin, "MEMBER", dept);
        MockHttpSession manager = user(admin, "MANAGER", dept);
        MockHttpSession otherManager = user(admin, "MANAGER", otherDept);
        MockHttpSession otherMember = user(admin, "MEMBER", otherDept);

        // Members submit for their own department only; the department defaults to their own.
        expense(member, otherDept, training, "10.00", true).andExpect(status().isForbidden());
        long draft = id(expense(member, null, training, "25.00", false)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.departmentId").value(dept))
                .andExpect(jsonPath("$.actions.submit").value(true))
                .andReturn());
        mvc.perform(post("/api/expenses/" + draft + "/submit").session(otherMember)).andExpect(status().isNotFound());
        mvc.perform(post("/api/expenses/" + draft + "/submit").session(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));

        // Members cannot approve; the manager of another department cannot either.
        mvc.perform(post("/api/expenses/" + draft + "/approve").session(member)).andExpect(status().isForbidden());
        mvc.perform(post("/api/expenses/" + draft + "/approve").session(otherManager)).andExpect(status().isForbidden());
        // Rejecting needs a reason.
        mvc.perform(json(post("/api/expenses/" + draft + "/reject"), "{}").session(manager)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/expenses/" + draft).session(manager))
                .andExpect(jsonPath("$.actions.approve").value(true))
                .andExpect(jsonPath("$.actions.pay").value(false));
        mvc.perform(json(post("/api/expenses/" + draft + "/approve"), "{\"note\":\"OK\"}").session(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.decisionNote").value("OK"));
        mvc.perform(post("/api/expenses/" + draft + "/approve").session(manager)).andExpect(status().isConflict());
        // Only finance pays.
        mvc.perform(post("/api/expenses/" + draft + "/pay").session(manager)).andExpect(status().isForbidden());
        mvc.perform(json(post("/api/expenses/" + draft + "/pay"), "{\"paidOn\":\"" + LocalDate.now().plusDays(1) + "\"}")
                        .session(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/expenses/" + draft + "/pay").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.paidOn").value(LocalDate.now().toString()));
        // Paid expenses are no longer editable or deletable.
        mvc.perform(json(put("/api/expenses/" + draft), "{\"categoryId\":" + training + ",\"amount\":1,\"date\":\""
                + day + "\",\"vendor\":\"X\"}").session(member)).andExpect(status().isConflict());
        mvc.perform(delete("/api/expenses/" + draft).session(member)).andExpect(status().isConflict());

        // Nobody approves their own expense: not a manager, not an admin with FINANCE_MANAGE.
        long managersOwn = submitted(manager, dept, training, "30.00");
        mvc.perform(post("/api/expenses/" + managersOwn + "/approve").session(manager))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You cannot approve or reject your own expense"));
        mvc.perform(post("/api/expenses/" + managersOwn + "/approve").session(admin)).andExpect(status().isOk());
        long adminsOwn = submitted(admin, dept, training, "40.00");
        mvc.perform(post("/api/expenses/" + adminsOwn + "/approve").session(admin)).andExpect(status().isForbidden());
        mvc.perform(post("/api/expenses/" + adminsOwn + "/approve").session(manager)).andExpect(status().isOk());

        // Drafts can be deleted by their author.
        long toDelete = id(expense(member, dept, training, "5.00", false).andReturn());
        mvc.perform(delete("/api/expenses/" + toDelete).session(otherMember)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/expenses/" + toDelete).session(member)).andExpect(status().isNoContent());

        // Members only see their own expenses; finance readers see the department's.
        mvc.perform(get("/api/expenses").param("departmentId", "" + dept).session(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.totalAmount").value(25.0));
        mvc.perform(get("/api/expenses").param("departmentId", "" + dept).param("size", "10").session(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalAmount").value(95.0));
        mvc.perform(get("/api/expenses").param("departmentId", "" + dept).param("status", "PAID").session(admin))
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/api/expenses").param("status", "nope").session(admin)).andExpect(status().isBadRequest());

        // Every transition is audited.
        mvc.perform(get("/api/audit").param("limit", "100").session(admin))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("expense_submitted")))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("expense_approved")))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("expense_paid")))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("expense_deleted")));
    }

    @Test
    void paymentsLedgerListsPaidExpensesWithMonthlyTotals() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long office = category(admin, "Office");
        MockHttpSession member = user(admin, "MEMBER", dept);
        long first = submitted(member, dept, office, "120.50");
        long second = submitted(member, dept, office, "79.50");
        for (long id : new long[]{first, second}) {
            mvc.perform(post("/api/expenses/" + id + "/approve").session(admin)).andExpect(status().isOk());
            mvc.perform(post("/api/expenses/" + id + "/pay").session(admin)).andExpect(status().isOk());
        }

        String month = LocalDate.now().toString().substring(0, 7);
        mvc.perform(get("/api/payments").param("departmentId", "" + dept).session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.totalAmount").value(200.0))
                .andExpect(jsonPath("$.months", hasSize(6)))
                .andExpect(jsonPath("$.months[5].month").value(month))
                .andExpect(jsonPath("$.months[5].total").value(200.0))
                .andExpect(jsonPath("$.items[0].vendor").value("JetBrains"))
                .andExpect(jsonPath("$.provider.connected").value(false));
        mvc.perform(get("/api/payments").session(member)).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ goals and performance

    @Test
    void attainmentHonoursTheDirectionAndIsClamped() {
        BigDecimal b40 = new BigDecimal("40");
        BigDecimal t60 = new BigDecimal("60");
        assertThat(GoalService.attainment(Goal.Direction.HIGHER_IS_BETTER, b40, t60, new BigDecimal("50"))).isEqualTo(50.0);
        assertThat(GoalService.attainment(Goal.Direction.HIGHER_IS_BETTER, b40, t60, new BigDecimal("60"))).isEqualTo(100.0);
        assertThat(GoalService.attainment(Goal.Direction.HIGHER_IS_BETTER, b40, t60, new BigDecimal("80"))).isEqualTo(120.0);
        assertThat(GoalService.attainment(Goal.Direction.HIGHER_IS_BETTER, b40, t60, new BigDecimal("30"))).isEqualTo(0.0);

        BigDecimal b8 = new BigDecimal("8");
        BigDecimal t4 = new BigDecimal("4");
        assertThat(GoalService.attainment(Goal.Direction.LOWER_IS_BETTER, b8, t4, new BigDecimal("7"))).isEqualTo(25.0);
        assertThat(GoalService.attainment(Goal.Direction.LOWER_IS_BETTER, b8, t4, new BigDecimal("4"))).isEqualTo(100.0);
        assertThat(GoalService.attainment(Goal.Direction.LOWER_IS_BETTER, b8, t4, new BigDecimal("1"))).isEqualTo(120.0);
        assertThat(GoalService.attainment(Goal.Direction.LOWER_IS_BETTER, b8, t4, new BigDecimal("9.5"))).isEqualTo(0.0);
        assertThat(GoalService.attainment(Goal.Direction.LOWER_IS_BETTER, b8, t4, null)).isNull();

        assertThat(GoalService.weightedScore(java.util.Arrays.asList(50.0, 100.0, null), List.of(3, 1, 5))).isEqualTo(62.5);
        assertThat(GoalService.weightedScore(java.util.Arrays.asList(null, null), List.of(1, 1))).isNull();
    }

    @Test
    void goalsAreScopedAndPerformanceIsTheWeightedAttainment() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long otherDept = department(admin);
        MockHttpSession manager = user(admin, "MANAGER", dept);
        MockHttpSession member = user(admin, "MEMBER", dept);
        MockHttpSession otherManager = user(admin, "MANAGER", otherDept);
        MockHttpSession viewer = user(admin, "VIEWER", otherDept);

        // Direction and target must agree.
        mvc.perform(json(post("/api/goals"), "{\"departmentId\":" + dept + ",\"name\":\"Bad\",\"unit\":\"%\","
                        + "\"direction\":\"LOWER_IS_BETTER\",\"baseline\":4,\"target\":8}").session(manager))
                .andExpect(status().isBadRequest());
        // Managers manage their own department's goals only; members not at all.
        mvc.perform(json(post("/api/goals"), "{\"departmentId\":" + dept + ",\"name\":\"X\",\"unit\":\"%\","
                        + "\"direction\":\"HIGHER_IS_BETTER\",\"baseline\":1,\"target\":2}").session(otherManager))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/goals"), "{\"departmentId\":" + dept + ",\"name\":\"X\",\"unit\":\"%\","
                        + "\"direction\":\"HIGHER_IS_BETTER\",\"baseline\":1,\"target\":2}").session(member))
                .andExpect(status().isForbidden());

        long higher = goal(manager, dept, "HIGHER_IS_BETTER", "40", "60", 3);   // 50 -> 50 %
        long lower = goal(manager, dept, "LOWER_IS_BETTER", "8", "4", 1);       // 2 -> 150 %, clamped to 120
        goal(admin, dept, "HIGHER_IS_BETTER", "0", "10", 5);                     // no data: not counted

        checkin(member, higher, "50").andExpect(status().isCreated()).andExpect(jsonPath("$.source").value("UI"));
        checkin(manager, lower, "2").andExpect(status().isCreated());
        checkin(otherManager, higher, "60").andExpect(status().isForbidden());
        checkin(viewer, higher, "60").andExpect(status().isForbidden());
        mvc.perform(json(post("/api/goals/" + higher + "/checkins"), "{\"date\":\"" + LocalDate.now().plusDays(1)
                + "\",\"value\":1}").session(member)).andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/goals/" + higher + "/checkins"), "{\"date\":\"" + quarter.start().minusDays(1)
                + "\",\"value\":1}").session(member)).andExpect(status().isBadRequest());

        mvc.perform(get("/api/goals").param("departmentId", "" + dept).session(member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[?(@.id == " + higher + ")].attainment").value(hasItem(50.0)))
                .andExpect(jsonPath("$[?(@.id == " + lower + ")].attainment").value(hasItem(120.0)))
                .andExpect(jsonPath("$[?(@.id == " + higher + ")].canEdit").value(hasItem(false)))
                .andExpect(jsonPath("$[?(@.id == " + higher + ")].canCheckIn").value(hasItem(true)));

        // (50 * 3 + 120 * 1) / 4 = 67.5
        String body = mvc.perform(get("/api/performance").param("year", "" + quarter.year())
                        .param("quarter", "" + quarter.quarter()).session(viewer))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String base = "$.departments[?(@.departmentId == " + dept + ")]";
        assertThat(JsonPath.<List<Double>>read(body, base + ".score")).containsExactly(67.5);
        assertThat(JsonPath.<List<Integer>>read(body, base + ".goalCount")).containsExactly(3);
        assertThat(JsonPath.<List<Integer>>read(body, base + ".goalsWithData")).containsExactly(2);
        List<Object> trend = JsonPath.read(body, base + ".trend[*].score");
        assertThat(trend).hasSize(6);
        assertThat(trend.getLast()).isEqualTo(67.5);

        // The person who recorded a check-in can delete it; others in the department cannot.
        String checkins = mvc.perform(get("/api/goals/" + lower + "/checkins").session(member))
                .andExpect(jsonPath("$[0].canDelete").value(false))
                .andReturn().getResponse().getContentAsString();
        long checkinId = ((Number) JsonPath.read(checkins, "$[0].id")).longValue();
        mvc.perform(delete("/api/goals/" + lower + "/checkins/" + checkinId).session(member)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/goals/" + lower + "/checkins/" + checkinId).session(manager)).andExpect(status().isNoContent());

        mvc.perform(get("/api/performance").session(user(admin, "MEMBER", otherDept))).andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ reports

    @Test
    void reportsOverviewCombinesSpendBudgetPerformanceAndHeadcount() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long marketing = category(admin, "Marketing");
        budget(admin, dept, marketing, "1000.00");
        MockHttpSession manager = user(admin, "MANAGER", dept);
        MockHttpSession member = user(admin, "MEMBER", dept);
        long approved = submitted(member, dept, marketing, "250.00");
        mvc.perform(post("/api/expenses/" + approved + "/approve").session(manager)).andExpect(status().isOk());
        submitted(member, dept, marketing, "100.00");
        long kpi = goal(manager, dept, "HIGHER_IS_BETTER", "0", "10", 1);
        checkin(member, kpi, "8").andExpect(status().isCreated());

        String body = mvc.perform(get("/api/reports/overview").param("from", quarter.start().toString())
                        .param("to", quarter.end().toString()).session(user(admin, "VIEWER", dept)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.performanceQuarter").value(quarter.quarter()))
                .andExpect(jsonPath("$.monthlySpend", hasSize(3)))
                .andReturn().getResponse().getContentAsString();
        String byDept = "[?(@.departmentId == " + dept + ")]";
        assertThat(JsonPath.<List<Double>>read(body, "$.spendByDepartment" + byDept + ".spent")).containsExactly(250.0);
        assertThat(JsonPath.<List<Double>>read(body, "$.budgetVsSpend" + byDept + ".budget")).containsExactly(1000.0);
        assertThat(JsonPath.<List<Double>>read(body, "$.budgetVsSpend" + byDept + ".committed")).containsExactly(100.0);
        assertThat(JsonPath.<List<Double>>read(body, "$.budgetVsSpend" + byDept + ".remaining")).containsExactly(650.0);
        assertThat(JsonPath.<List<Double>>read(body, "$.budgetVsSpend" + byDept + ".utilisation")).containsExactly(25.0);
        assertThat(JsonPath.<List<Double>>read(body, "$.performance" + byDept + ".score")).containsExactly(80.0);
        assertThat(JsonPath.<List<Integer>>read(body, "$.headcount" + byDept + ".active")).containsExactly(3);
        assertThat(JsonPath.<List<String>>read(body, "$.spendByCategory[*].categoryName")).contains("Marketing");

        mvc.perform(get("/api/reports/overview").session(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/reports/overview").param("from", "2026-05-01").param("to", "2026-04-01").session(admin))
                .andExpect(status().isBadRequest());

        // CSV exports.
        mvc.perform(get("/api/reports/export.csv").param("type", "budgets").param("from", quarter.start().toString())
                        .param("to", quarter.end().toString()).session(admin))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(content().string(containsString("year,quarter,department,category,budget,spent")))
                .andExpect(content().string(containsString(",Marketing,1000.00,250.00,100.00,650.00,EUR")));
        mvc.perform(get("/api/reports/export.csv").param("type", "expenses").session(admin))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("id,date,department,category,vendor")));
        mvc.perform(get("/api/reports/export.csv").param("type", "performance").session(admin)).andExpect(status().isOk());
        mvc.perform(get("/api/reports/export.csv").param("type", "salaries").session(admin)).andExpect(status().isBadRequest());
        // Viewers read reports but not individual expenses.
        mvc.perform(get("/api/reports/export.csv").param("type", "expenses").session(user(admin, "VIEWER", dept)))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ CSV import

    @Test
    void businessImportsReportErrorsPerRow() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        String deptName = JsonPath.read(mvc.perform(get("/api/departments")).andReturn().getResponse().getContentAsString(),
                "$[?(@.id == " + dept + ")].name").toString().replaceAll("[\\[\\]\"]", "");
        int year = quarter.year();

        mvc.perform(json(post("/api/import/budgets"), "{\"rows\":["
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"year\":\"" + year + "\",\"quarter\":\"Q" + quarter.quarter() + "\",\"amount\":\"1 500.00\"},"
                        + "{\"department\":\"Nowhere\",\"category\":\"Travel\",\"year\":\"" + year + "\",\"quarter\":\"1\",\"amount\":\"10\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"year\":\"" + year + "\",\"quarter\":\"5\",\"amount\":\"10\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"year\":\"" + year + "\",\"quarter\":\"" + quarter.quarter() + "\",\"amount\":\"20\"}"
                        + "]}").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.skipped").value(3))
                .andExpect(jsonPath("$.errors[0].row").value(2))
                .andExpect(jsonPath("$.errors[0].message").value("Unknown department \"Nowhere\""))
                .andExpect(jsonPath("$.errors[1].row").value(3))
                .andExpect(jsonPath("$.errors[2].row").value(4))
                .andExpect(jsonPath("$.errors[2].message", containsString("already exists")));

        mvc.perform(json(post("/api/import/expenses"), "{\"rows\":["
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"amount\":\"1600\",\"date\":\"" + day + "\",\"vendor\":\"Lufthansa\",\"status\":\"PAID\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"amount\":\"abc\",\"date\":\"" + day + "\",\"vendor\":\"Lufthansa\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"amount\":\"10\",\"date\":\"" + LocalDate.now().plusDays(3) + "\",\"vendor\":\"Lufthansa\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"amount\":\"10\",\"date\":\"" + day + "\",\"vendor\":\"\"},"
                        + "{\"department\":\"" + deptName + "\",\"category\":\"Travel\",\"amount\":\"10\",\"date\":\"" + day + "\",\"vendor\":\"Uber\",\"status\":\"SUBMITTED\"}"
                        + "]}").session(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.skipped").value(3))
                .andExpect(jsonPath("$.errors[*].row").value(org.hamcrest.Matchers.contains(2, 3, 4)));
        // The imported, paid 1600 overspent the 1500 budget, so the submitted 10 is flagged.
        mvc.perform(get("/api/expenses").param("departmentId", "" + dept).param("status", "SUBMITTED").session(admin))
                .andExpect(jsonPath("$.items[0].overBudget").value(true));
        mvc.perform(get("/api/budgets").param("departmentId", "" + dept).session(admin))
                .andExpect(jsonPath("$.lines[0].spent").value(1600.0))
                .andExpect(jsonPath("$.lines[0].remaining").value(-110.0));

        MockHttpSession manager = user(admin, "MANAGER", dept);
        long kpi = goal(manager, dept, "HIGHER_IS_BETTER", "0", "10", 1);
        String kpiName = JsonPath.read(mvc.perform(get("/api/goals/" + kpi).session(admin)).andReturn().getResponse()
                .getContentAsString(), "$.name");
        mvc.perform(json(post("/api/import/checkins"), "{\"rows\":["
                        + "{\"goalId\":\"" + kpi + "\",\"date\":\"" + day + "\",\"value\":\"4\"},"
                        + "{\"department\":\"" + deptName + "\",\"goal\":\"" + kpiName + "\",\"date\":\"" + day + "\",\"value\":\"5\",\"note\":\"From CSV\"},"
                        + "{\"department\":\"" + deptName + "\",\"goal\":\"No such goal\",\"date\":\"" + day + "\",\"value\":\"5\"},"
                        + "{\"goalId\":\"" + kpi + "\",\"date\":\"" + day + "\",\"value\":\"lots\"}"
                        + "]}").session(manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.errors[*].row").value(org.hamcrest.Matchers.contains(3, 4)));
        mvc.perform(get("/api/goals/" + kpi + "/checkins").session(admin))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].source").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("CSV"))));

        // Expense and budget imports are for finance.
        mvc.perform(json(post("/api/import/budgets"), "{\"rows\":[{}]}").session(manager)).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ API-key ingest

    private String apiKey(MockHttpSession admin, String scopes) throws Exception {
        String body = mvc.perform(json(post("/api/keys"), "{\"name\":\"" + unique("Ingest") + "\",\"scopes\":" + scopes + "}")
                        .session(admin))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.secret");
    }

    @Test
    void ingestAcceptsScopedApiKeysWithoutASession() throws Exception {
        MockHttpSession admin = admin();
        long dept = department(admin);
        long kpi = goal(admin, dept, "HIGHER_IS_BETTER", "90", "99", 1);
        String scoped = apiKey(admin, "[\"ingest:checkins\"]");
        String unscoped = apiKey(admin, "[]");
        String payload = "{\"checkins\":[{\"goalId\":" + kpi + ",\"date\":\"" + day + "\",\"value\":97.5},"
                + "{\"goalId\":999999,\"value\":1},{\"goalId\":" + kpi + "}]}";

        MvcResult result = mvc.perform(json(post("/api/ingest/checkins"), payload)
                        .header("Authorization", "Bearer " + scoped))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(1))
                .andExpect(jsonPath("$.skipped").value(2))
                .andExpect(jsonPath("$.errors[0].row").value(2))
                .andExpect(jsonPath("$.errors[0].message").value("Goal not found"))
                .andReturn();
        // Stateless: no session is created and no cookie is set.
        assertThat(result.getRequest().getSession(false)).isNull();
        assertThat(result.getResponse().getHeader("Set-Cookie")).isNull();

        mvc.perform(get("/api/goals/" + kpi + "/checkins").session(admin))
                .andExpect(jsonPath("$[0].source").value("API"))
                .andExpect(jsonPath("$[0].recordedBy", containsString("API key: Ingest-")));
        mvc.perform(get("/api/goals/" + kpi).session(admin)).andExpect(jsonPath("$.attainment").value(83.3));

        // A key without the scope: 403. A wrong or missing key: 401. A session is not enough.
        mvc.perform(json(post("/api/ingest/checkins"), payload).header("Authorization", "Bearer " + unscoped))
                .andExpect(status().isForbidden());
        mvc.perform(json(post("/api/ingest/checkins"), payload).header("Authorization", "Bearer msk_wrong"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid API key"));
        mvc.perform(json(post("/api/ingest/checkins"), payload)).andExpect(status().isUnauthorized());
        mvc.perform(json(post("/api/ingest/checkins"), payload).session(admin)).andExpect(status().isUnauthorized());

        // Keys can only get known scopes, and the list shows them.
        mvc.perform(json(post("/api/keys"), "{\"scopes\":[\"admin:everything\"]}").session(admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/keys").session(admin))
                .andExpect(jsonPath("$[*].scopes[*]").value(hasItem("ingest:checkins")));
        mvc.perform(get("/api/audit").param("limit", "50").session(admin))
                .andExpect(jsonPath("$[*].eventType").value(hasItem("checkins_ingested")));
    }

    // ------------------------------------------------------------------ demo data

    @Test
    void demoBusinessSeederRunsOnce() {
        demoSeeder.seed();
        Long expenses = jdbc.queryForObject("SELECT COUNT(*) FROM expenses", Long.class);
        Long budgets = jdbc.queryForObject("SELECT COUNT(*) FROM budgets", Long.class);
        Long checkins = jdbc.queryForObject("SELECT COUNT(*) FROM goal_checkins", Long.class);

        assertThat(demoSeeder.seed()).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expenses", Long.class)).isEqualTo(expenses);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM budgets", Long.class)).isEqualTo(budgets);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM goal_checkins", Long.class)).isEqualTo(checkins);

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM expenses WHERE vendor IN ('Adobe', 'JetBrains', "
                + "'Autodesk', 'Amazon Web Services', 'Payroll')", Long.class)).isGreaterThan(20);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM goals g JOIN departments d ON d.id = g.department_id "
                + "WHERE d.name = 'Development' AND g.name = 'Sprint velocity'", Long.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(DISTINCT status) FROM expenses", Long.class)).isEqualTo(5);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM org_settings WHERE key = ?", Long.class,
                DemoBusinessSeeder.MARKER)).isEqualTo(1);
    }
}
