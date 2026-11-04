package com.msframework.backend.config;

import com.msframework.backend.entity.Budget;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Expense;
import com.msframework.backend.entity.ExpenseCategory;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.entity.GoalCheckin;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.BudgetRepository;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.ExpenseCategoryRepository;
import com.msframework.backend.repository.ExpenseRepository;
import com.msframework.backend.repository.GoalCheckinRepository;
import com.msframework.backend.repository.GoalRepository;
import com.msframework.backend.repository.OrgSettingRepository;
import com.msframework.backend.repository.UserRepository;
import com.msframework.backend.service.ExpenseService;
import com.msframework.backend.service.FiscalPeriods;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

/**
 * Demo business data (when {@code app.seed.demo} is true): budgets, about 350 expenses, goals and
 * weekly check-ins for the current and the two previous quarters, for the seven studio departments.
 *
 * <p>It runs once per database (marker {@code demo.business.v1} in org_settings), after every
 * start-up runner, so after DatabaseSeeder and the demo people seeder, under the same advisory lock.
 * It works with whatever users exist: departments are matched by name (missing standard ones are
 * created), submitters are the department's members (the admin when it has none), approvers its
 * manager or an admin, and nothing already there is changed or removed.</p>
 */
@Component
public class DemoBusinessSeeder {

    public static final String MARKER = "demo.business.v1";
    private static final Logger log = LoggerFactory.getLogger(DemoBusinessSeeder.class);

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final ExpenseCategoryRepository categoryRepository;
    private final BudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;
    private final GoalRepository goalRepository;
    private final GoalCheckinRepository checkinRepository;
    private final OrgSettingRepository orgSettingRepository;
    private final ExpenseService expenseService;
    private final FinanceSettings finance;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final boolean enabled;

    public DemoBusinessSeeder(DepartmentRepository departmentRepository, UserRepository userRepository,
                              ExpenseCategoryRepository categoryRepository, BudgetRepository budgetRepository,
                              ExpenseRepository expenseRepository, GoalRepository goalRepository,
                              GoalCheckinRepository checkinRepository, OrgSettingRepository orgSettingRepository,
                              ExpenseService expenseService, FinanceSettings finance, JdbcTemplate jdbc,
                              PlatformTransactionManager transactionManager,
                              @Value("${app.seed.demo:true}") boolean enabled) {
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.expenseRepository = expenseRepository;
        this.goalRepository = goalRepository;
        this.checkinRepository = checkinRepository;
        this.orgSettingRepository = orgSettingRepository;
        this.expenseService = expenseService;
        this.finance = finance;
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
    }

    /**
     * Runs on ApplicationReadyEvent, which Spring publishes after every ApplicationRunner and
     * CommandLineRunner (DatabaseSeeder, DemoPeopleSeeder), so the admin, the departments and the
     * demo people already exist. Order 200 also places it after any listener with a lower order.
     * Managers are the users with the MANAGER role in a department, so it does not depend on
     * departments.manager_id.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Order(200)
    public void onReady() {
        if (enabled) seed();
    }

    /** Seeds once; returns false when the marker says it already ran. */
    public boolean seed() {
        Boolean seeded = transaction.execute(status -> {
            jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext('msf-seeder'))");
            if (orgSettingRepository.existsById(MARKER)) return false;
            Counts counts = new Run(LocalDate.now()).run();
            orgSettingRepository.save(OrgSetting.builder()
                    .key(MARKER)
                    .value("Seeded " + LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS))
                    .updatedAt(LocalDateTime.now())
                    .build());
            log.info("[SEEDER] Demo business data: {} budget lines, {} expenses, {} goals, {} check-ins",
                    counts.budgets, counts.expenses, counts.goals, counts.checkins);
            return true;
        });
        return Boolean.TRUE.equals(seeded);
    }

    private static final class Counts {
        int budgets;
        int expenses;
        int goals;
        int checkins;
    }

    // ------------------------------------------------------------------ the studio's plan

    private record Vendor(String name, String description) {}

    private record GoalSpec(String name, String unit, Goal.Direction direction, double baseline, double target,
                            int weight, boolean cumulative, int decimals, String source) {}

    /** Department name, seal colour key, quarterly budget per category, and goals. */
    private record DeptSpec(String name, String color, Map<String, Integer> budgets, List<GoalSpec> goals) {}

    private static final String SALARIES = "Salaries";

    private static final List<DeptSpec> DEPARTMENTS = List.of(
            new DeptSpec("Administration", "avatar-rose", ordered(
                    SALARIES, 60000, "Office", 27000, "Software & licences", 3000, "Hardware", 2000,
                    "Training", 1500, "Other", 4500), List.of(
                    new GoalSpec("Invoices processed on time", "%", Goal.Direction.HIGHER_IS_BETTER, 82, 95, 3, false, 1, "UI"),
                    new GoalSpec("Month-end close", "days", Goal.Direction.LOWER_IS_BETTER, 9, 5, 1, false, 0, "UI"))),
            new DeptSpec("Development", "avatar-violet", ordered(
                    SALARIES, 250000, "Software & licences", 24000, "Hardware", 18000, "Contractors", 15000,
                    "Training", 6000, "Travel", 5000), List.of(
                    new GoalSpec("Sprint velocity", "points", Goal.Direction.HIGHER_IS_BETTER, 42, 55, 3, false, 0, "UI"),
                    new GoalSpec("Bug escape rate", "%", Goal.Direction.LOWER_IS_BETTER, 8, 4, 2, false, 1, "UI"),
                    new GoalSpec("Build pipeline success rate", "%", Goal.Direction.HIGHER_IS_BETTER, 88, 97, 1, false, 1,
                            "API key: CI pipeline"))),
            new DeptSpec("Quality Control", "avatar-azure", ordered(
                    SALARIES, 96000, "Contractors", 12000, "Hardware", 9000, "Software & licences", 6000,
                    "Training", 2500), List.of(
                    new GoalSpec("Automated test coverage", "%", Goal.Direction.HIGHER_IS_BETTER, 61, 75, 3, false, 1,
                            "API key: CI pipeline"),
                    new GoalSpec("Defects found before release", "%", Goal.Direction.HIGHER_IS_BETTER, 78, 90, 2, false, 1, "UI"),
                    new GoalSpec("Regression suite run time", "minutes", Goal.Direction.LOWER_IS_BETTER, 95, 60, 1, false, 0, "UI"))),
            new DeptSpec("External Affairs", "avatar-jade", ordered(
                    SALARIES, 66000, "Marketing", 45000, "Travel", 12000, "Software & licences", 2500,
                    "Other", 3000), List.of(
                    new GoalSpec("Partnerships signed", "count", Goal.Direction.HIGHER_IS_BETTER, 0, 6, 3, true, 0, "UI"),
                    new GoalSpec("Press mentions", "count", Goal.Direction.HIGHER_IS_BETTER, 0, 40, 2, true, 0, "CSV"),
                    new GoalSpec("Steam wishlist additions", "count", Goal.Direction.HIGHER_IS_BETTER, 0, 25000, 2, true, 0,
                            "API key: Steamworks sync"))),
            new DeptSpec("Ethics & Regulations", "avatar-silver", ordered(
                    SALARIES, 39000, "Contractors", 9000, "Training", 2000, "Software & licences", 1500), List.of(
                    new GoalSpec("Compliance reviews done", "count", Goal.Direction.HIGHER_IS_BETTER, 0, 12, 3, true, 0, "UI"),
                    new GoalSpec("Open audit findings", "count", Goal.Direction.LOWER_IS_BETTER, 9, 2, 2, false, 0, "UI"))),
            new DeptSpec("Human Resources", "avatar-orange", ordered(
                    SALARIES, 48000, "Contractors", 8000, "Training", 6000, "Software & licences", 3500,
                    "Travel", 2000), List.of(
                    new GoalSpec("Time to hire", "days", Goal.Direction.LOWER_IS_BETTER, 48, 35, 2, false, 0, "CSV"),
                    new GoalSpec("12-month retention", "%", Goal.Direction.HIGHER_IS_BETTER, 86, 92, 2, false, 1, "CSV"),
                    new GoalSpec("Onboarding satisfaction", "score", Goal.Direction.HIGHER_IS_BETTER, 3.8, 4.5, 1, false, 2, "UI"))),
            new DeptSpec("Engineering & Innovation", "avatar-snow", ordered(
                    SALARIES, 120000, "Software & licences", 14000, "Hardware", 16000, "Training", 3500,
                    "Travel", 3000), List.of(
                    new GoalSpec("R&D prototypes delivered", "count", Goal.Direction.HIGHER_IS_BETTER, 0, 4, 2, true, 0, "UI"),
                    new GoalSpec("Build farm uptime", "%", Goal.Direction.HIGHER_IS_BETTER, 98.2, 99.5, 3, false, 2,
                            "API key: Uptime monitor"),
                    new GoalSpec("Cloud cost per build", "EUR", Goal.Direction.LOWER_IS_BETTER, 4.8, 3.5, 1, false, 2, "UI")))
    );

    private static final Map<String, List<Vendor>> VENDORS = Map.of(
            "Software & licences", List.of(
                    new Vendor("Adobe", "Creative Cloud seats"),
                    new Vendor("JetBrains", "Rider and CLion licences"),
                    new Vendor("Autodesk", "Maya and 3ds Max subscriptions"),
                    new Vendor("Amazon Web Services", "Build servers and storage"),
                    new Vendor("Perforce", "Helix Core seats"),
                    new Vendor("Atlassian", "Jira and Confluence"),
                    new Vendor("GitHub", "Enterprise seats and Actions minutes"),
                    new Vendor("Figma", "Organisation plan"),
                    new Vendor("SideFX", "Houdini licences"),
                    new Vendor("Microsoft", "Microsoft 365 business plan")),
            "Hardware", List.of(
                    new Vendor("Dell", "Precision workstation"),
                    new Vendor("Lenovo", "ThinkPad laptops"),
                    new Vendor("Wacom", "Cintiq pen display"),
                    new Vendor("Sony Interactive Entertainment", "PlayStation devkit"),
                    new Vendor("Nintendo", "Switch development kit"),
                    new Vendor("Valve", "Steam Deck test units"),
                    new Vendor("Logitech", "Headsets and webcams")),
            "Travel", List.of(
                    new Vendor("Lufthansa", "Flights to a partner meeting"),
                    new Vendor("Deutsche Bahn", "Train tickets"),
                    new Vendor("Booking.com", "Hotel for Gamescom"),
                    new Vendor("Airbnb", "Team accommodation"),
                    new Vendor("Uber", "Airport transfers")),
            "Marketing", List.of(
                    new Vendor("Steam", "Steamworks featuring and ads"),
                    new Vendor("Meta", "Trailer campaign ads"),
                    new Vendor("Google Ads", "Search campaign"),
                    new Vendor("IGN", "Sponsored preview"),
                    new Vendor("Twitch", "Creator sponsorship"),
                    new Vendor("Koelnmesse", "Gamescom booth space")),
            "Training", List.of(
                    new Vendor("Game Developers Conference", "GDC passes"),
                    new Vendor("Udemy Business", "Team learning licences"),
                    new Vendor("ISTQB", "Tester certification exam"),
                    new Vendor("Unreal Fest", "Conference tickets"),
                    new Vendor("Pluralsight", "Skills subscription")),
            "Contractors", List.of(
                    new Vendor("Keywords Studios", "Localisation"),
                    new Vendor("Testronic", "Compatibility testing"),
                    new Vendor("Upwork", "Freelance concept art"),
                    new Vendor("Sonic Forge Audio", "Sound design"),
                    new Vendor("Hays", "Recruitment fee"),
                    new Vendor("Lex & Partners", "Legal counsel")),
            "Office", List.of(
                    new Vendor("Impact Hub coworking", "Desk and meeting room membership"),
                    new Vendor("Staples", "Office supplies"),
                    new Vendor("Nespresso Professional", "Coffee"),
                    new Vendor("CleanCo", "Office cleaning"),
                    new Vendor("E.ON", "Electricity")),
            "Other", List.of(
                    new Vendor("Allianz", "Business insurance"),
                    new Vendor("Deutsche Bank", "Bank fees"),
                    new Vendor("Team event", "Quarterly team dinner"),
                    new Vendor("DHL", "Shipping devkits"))
    );

    private static final List<String> REJECTIONS = List.of(
            "Not in this quarter's plan",
            "Please attach the invoice and resubmit",
            "Duplicate of an earlier claim",
            "Use the company licence instead",
            "Over the department's limit for this category");

    private static Map<String, Integer> ordered(Object... pairs) {
        Map<String, Integer> map = new java.util.LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) map.put((String) pairs[i], (Integer) pairs[i + 1]);
        return map;
    }

    // ------------------------------------------------------------------ one seeding run

    private final class Run {

        private final LocalDate today;
        private final Random random = new Random(20260401L);
        private final Counts counts = new Counts();
        private final List<FiscalPeriods.Quarter> quarters = new ArrayList<>();
        private final Map<String, ExpenseCategory> categories = new HashMap<>();
        private final User admin;
        private final List<User> users;

        Run(LocalDate today) {
            this.today = today;
            FiscalPeriods.Quarter current = FiscalPeriods.of(today);
            quarters.add(current.previous().previous());
            quarters.add(current.previous());
            quarters.add(current);
            categoryRepository.findAll().forEach(c -> categories.put(c.getName().toLowerCase(Locale.ROOT), c));
            users = userRepository.findAllByOrderByIdAsc().stream().filter(User::isActive).toList();
            admin = users.stream().filter(u -> u.hasRole(SystemRoles.ADMIN)).findFirst()
                    .orElseGet(() -> userRepository.findAllByOrderByIdAsc().getFirst());
        }

        Counts run() {
            for (DeptSpec spec : DEPARTMENTS) {
                Department department = departmentRepository.findByNameIgnoreCase(spec.name())
                        .orElseGet(() -> departmentRepository.save(
                                Department.builder().name(spec.name()).color(spec.color()).build()));
                List<User> members = users.stream()
                        .filter(u -> u.getDepartment() != null && u.getDepartment().getId().equals(department.getId()))
                        .toList();
                User manager = members.stream().filter(u -> u.hasRole(SystemRoles.MANAGER)).findFirst().orElse(null);
                List<User> submitters = members.stream().filter(u -> !u.hasRole(SystemRoles.ADMIN)).toList();
                if (submitters.isEmpty()) submitters = List.of(admin);

                double[] performance = new double[quarters.size()];
                for (int i = 0; i < performance.length; i++) performance[i] = 0.7 + random.nextDouble() * 0.4;

                seedBudgets(department, spec);
                seedExpenses(department, spec, submitters, manager);
                seedGoals(department, spec, members, manager, performance);
            }
            expenseRepository.flush();
            return counts;
        }

        private ExpenseCategory category(String name) {
            ExpenseCategory category = categories.get(name.toLowerCase(Locale.ROOT));
            if (category == null) {
                category = categoryRepository.save(ExpenseCategory.builder().name(name).build());
                categories.put(name.toLowerCase(Locale.ROOT), category);
            }
            return category;
        }

        /** The quarter's plan: the base amount, a little higher towards the end of the year. */
        private BigDecimal budgetAmount(DeptSpec spec, String category, FiscalPeriods.Quarter quarter) {
            double factor = 1.0 + (quarter.quarter() - 2) * 0.03;
            long amount = Math.round(spec.budgets().get(category) * factor / 500.0) * 500;
            return BigDecimal.valueOf(amount).setScale(2, RoundingMode.UNNECESSARY);
        }

        private void seedBudgets(Department department, DeptSpec spec) {
            for (FiscalPeriods.Quarter quarter : quarters) {
                for (String name : spec.budgets().keySet()) {
                    ExpenseCategory category = category(name);
                    if (budgetRepository.findLine(department.getId(), category.getId(), quarter.year(), quarter.quarter())
                            .isPresent()) continue;
                    budgetRepository.save(Budget.builder()
                            .department(department)
                            .category(category)
                            .year(quarter.year())
                            .quarter(quarter.quarter())
                            .amount(budgetAmount(spec, name, quarter))
                            .currency(finance.currency())
                            .notes(quarter.equals(quarters.getLast()) ? "Demo data" : null)
                            .createdBy(admin.getEmail())
                            .build());
                    counts.budgets++;
                }
            }
        }

        private void seedExpenses(Department department, DeptSpec spec, List<User> submitters, User manager) {
            double spendFactor = 0.78 + random.nextDouble() * 0.27;
            LocalDate start = quarters.getFirst().start();
            for (YearMonth month : FiscalPeriods.monthsBetween(start, today)) {
                FiscalPeriods.Quarter quarter = FiscalPeriods.of(month.atDay(1));
                LocalDate monthEnd = month.atEndOfMonth();
                LocalDate lastDay = monthEnd.isAfter(today) ? today : monthEnd;
                double elapsed = (lastDay.getDayOfMonth()) / (double) month.lengthOfMonth();

                for (String name : spec.budgets().keySet()) {
                    BigDecimal monthly = budgetAmount(spec, name, quarter).divide(BigDecimal.valueOf(3), 2, RoundingMode.HALF_UP);
                    if (SALARIES.equals(name)) {
                        if (monthEnd.isAfter(today)) continue; // this month's payroll is not due yet
                        double payroll = monthly.doubleValue() * (0.96 + random.nextDouble() * 0.04);
                        LocalDate payday = monthEnd.with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY));
                        addExpense(department, category(name), payroll, payday, new Vendor("Payroll",
                                "Salaries for " + month.getMonth().getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH)
                                        + " " + month.getYear()), submitters, manager, true);
                        continue;
                    }
                    int[] range = switch (name) {
                        case "Software & licences" -> new int[]{1, 4};
                        case "Marketing", "Contractors", "Travel" -> new int[]{1, 2};
                        case "Office" -> new int[]{1, 2};
                        default -> new int[]{0, 1};
                    };
                    int n = range[0] + random.nextInt(range[1] - range[0] + 1);
                    if (n == 0) continue;
                    double target = monthly.doubleValue() * spendFactor * (0.8 + random.nextDouble() * 0.4) * elapsed;
                    double[] weights = new double[n];
                    double weightSum = 0;
                    for (int i = 0; i < n; i++) {
                        weights[i] = 0.5 + random.nextDouble();
                        weightSum += weights[i];
                    }
                    List<Vendor> vendors = VENDORS.getOrDefault(name, VENDORS.get("Other"));
                    for (int i = 0; i < n; i++) {
                        double amount = Math.max(15, target * weights[i] / weightSum);
                        LocalDate date = month.atDay(1 + random.nextInt(lastDay.getDayOfMonth()));
                        addExpense(department, category(name), amount, date, vendors.get(random.nextInt(vendors.size())),
                                submitters, manager, false);
                    }
                }
            }
        }

        private void addExpense(Department department, ExpenseCategory category, double rawAmount, LocalDate date,
                                Vendor vendor, List<User> submitters, User manager, boolean payroll) {
            User submitter = payroll ? (manager != null ? manager : submitters.getFirst())
                    : submitters.get(random.nextInt(submitters.size()));
            User approver = approverFor(submitter, manager);
            long age = ChronoUnit.DAYS.between(date, today);
            double roll = random.nextDouble();
            Expense.Status status;
            if (payroll) status = Expense.Status.PAID;
            else if (age > 45) status = roll < 0.06 ? Expense.Status.REJECTED : Expense.Status.PAID;
            else if (age > 14) status = roll < 0.05 ? Expense.Status.REJECTED : roll < 0.15 ? Expense.Status.SUBMITTED
                    : roll < 0.45 ? Expense.Status.APPROVED : Expense.Status.PAID;
            else status = roll < 0.12 ? Expense.Status.DRAFT : roll < 0.17 ? Expense.Status.REJECTED
                    : roll < 0.55 ? Expense.Status.SUBMITTED : roll < 0.8 ? Expense.Status.APPROVED : Expense.Status.PAID;

            LocalDateTime submittedAt = date.atTime(9 + random.nextInt(8), random.nextInt(60));
            LocalDate decidedOn = date.plusDays(1 + random.nextInt(4));
            if (decidedOn.isAfter(today)) decidedOn = today;
            LocalDate paidOn = payroll ? date : decidedOn.plusDays(2 + random.nextInt(12));
            if (status == Expense.Status.PAID && paidOn.isAfter(today)) status = Expense.Status.APPROVED;

            Expense expense = Expense.builder()
                    .department(department)
                    .category(category)
                    .amount(BigDecimal.valueOf(rawAmount).setScale(2, RoundingMode.HALF_UP))
                    .currency(finance.currency())
                    .expenseDate(date)
                    .vendor(vendor.name())
                    .description(vendor.description())
                    .reference(payroll ? "PAY-" + date.getYear() + "-" + String.format("%02d", date.getMonthValue())
                            : "INV-" + (10000 + random.nextInt(89999)))
                    .status(status)
                    .submittedById(submitter.getId())
                    .submittedByEmail(submitter.getEmail())
                    .submittedAt(status == Expense.Status.DRAFT ? null : submittedAt)
                    .createdAt(submittedAt)
                    .updatedAt(submittedAt)
                    .build();
            if (status != Expense.Status.DRAFT && status != Expense.Status.SUBMITTED) {
                expense.setDecidedById(approver.getId());
                expense.setDecidedByEmail(approver.getEmail());
                expense.setDecidedAt(decidedOn.atTime(10 + random.nextInt(7), random.nextInt(60)));
                if (status == Expense.Status.REJECTED) {
                    expense.setDecisionNote(REJECTIONS.get(random.nextInt(REJECTIONS.size())));
                }
            }
            if (status == Expense.Status.PAID) {
                expense.setPaidOn(paidOn);
                expense.setPaidAt(paidOn.atTime(15, 0));
                expense.setPaidByEmail(admin.getEmail());
                expense.setPaymentReference("TRF-" + paidOn.toString().replace("-", "") + "-" + (100 + random.nextInt(900)));
            }
            expense = expenseRepository.save(expense);
            if (status == Expense.Status.SUBMITTED) {
                expenseRepository.flush();
                expense.setOverBudget(expenseService.isOverBudget(expense));
            }
            counts.expenses++;
        }

        /** The department manager, else an admin or manager who is not the submitter, else the admin. */
        private User approverFor(User submitter, User manager) {
            if (manager != null && !manager.getId().equals(submitter.getId())) return manager;
            return users.stream()
                    .filter(u -> !u.getId().equals(submitter.getId()))
                    .filter(u -> u.hasRole(SystemRoles.ADMIN))
                    .findFirst()
                    .orElse(admin);
        }

        private void seedGoals(Department department, DeptSpec spec, List<User> members, User manager,
                               double[] performance) {
            User owner = manager != null ? manager : members.isEmpty() ? admin : members.getFirst();
            for (int q = 0; q < quarters.size(); q++) {
                FiscalPeriods.Quarter quarter = quarters.get(q);
                for (GoalSpec g : spec.goals()) {
                    boolean exists = goalRepository.findByDepartmentAndName(department.getId(), g.name()).stream()
                            .anyMatch(existing -> existing.getYear() == quarter.year()
                                    && existing.getQuarter() == quarter.quarter());
                    if (exists) continue;
                    // Later quarters raise the bar a little.
                    double stretch = 1 + q * 0.05;
                    double baseline = g.baseline();
                    double target = g.cumulative() ? Math.round(g.target() * stretch) : g.target();
                    Goal goal = goalRepository.save(Goal.builder()
                            .department(department)
                            .name(g.name())
                            .unit(g.unit())
                            .direction(g.direction())
                            .baseline(scale(baseline, 2))
                            .target(scale(target, 2))
                            .weight(g.weight())
                            .year(quarter.year())
                            .quarter(quarter.quarter())
                            .owner(owner)
                            .createdBy(admin.getEmail())
                            .build());
                    counts.goals++;
                    seedCheckins(goal, g, quarter, performance[q], members, owner);
                }
            }
        }

        /** Weekly values on Fridays that move from the baseline toward the target. */
        private void seedCheckins(Goal goal, GoalSpec spec, FiscalPeriods.Quarter quarter, double performance,
                                  List<User> members, User owner) {
            double baseline = goal.getBaseline().doubleValue();
            double target = goal.getTarget().doubleValue();
            double span = target - baseline;
            double previous = baseline;
            List<GoalCheckin> rows = new ArrayList<>();
            LocalDate first = quarter.start().with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));
            int weeks = (int) ChronoUnit.WEEKS.between(first, quarter.end()) + 1;
            for (int w = 0; w < weeks; w++) {
                LocalDate date = first.plusWeeks(w);
                if (date.isAfter(today) || date.isAfter(quarter.end())) break;
                double progress = Math.pow((w + 1) / (double) weeks, spec.cumulative() ? 1.0 : 0.7) * performance;
                double noise = spec.cumulative() ? 0 : (random.nextDouble() - 0.5) * 0.08 * Math.abs(span);
                double value = baseline + span * progress + noise;
                if (spec.cumulative()) value = Math.max(previous, Math.floor(value + random.nextDouble() * 0.6));
                previous = value;
                User recorder = members.isEmpty() ? owner : members.get(random.nextInt(members.size()));
                boolean integration = spec.source().startsWith("API key");
                GoalCheckin.Source source = integration ? GoalCheckin.Source.API
                        : "CSV".equals(spec.source()) ? GoalCheckin.Source.CSV : GoalCheckin.Source.UI;
                rows.add(GoalCheckin.builder()
                        .goalId(goal.getId())
                        .date(date)
                        .value(scale(value, spec.decimals()))
                        .note(w == 0 ? "First check-in of " + quarter : null)
                        .source(source)
                        .recordedById(integration ? null : recorder.getId())
                        .recordedBy(integration ? spec.source() : recorder.getEmail())
                        .createdAt(date.atTime(17, 0))
                        .build());
            }
            rows.sort(Comparator.comparing(GoalCheckin::getDate));
            checkinRepository.saveAll(rows);
            counts.checkins += rows.size();
        }

        private BigDecimal scale(double value, int decimals) {
            return BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).setScale(2, RoundingMode.UNNECESSARY);
        }
    }
}
