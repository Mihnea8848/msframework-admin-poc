package com.msframework.backend.config;

import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.OrgSetting;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.repository.DepartmentRepository;
import com.msframework.backend.repository.OrgSettingRepository;
import com.msframework.backend.repository.RoleRepository;
import com.msframework.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Seeds MEH Studios' real leadership: the director and the heads of department. They are public
 * figures of the studio and agreed to be listed, which is why their names and work addresses may
 * live in this public repository; nobody else's may (see AGENTS.md).
 *
 * <p>Runs after {@link DatabaseSeeder} and before the demo seeders, once per database (marker
 * {@value #MARKER}). Existing addresses are left alone. Accounts get an unusable password: they
 * sign in after an admin reset link, or once the Authentik sync has linked them. Each head becomes
 * their department's manager when it has none or when the current one is a demo person.</p>
 */
@Component
@Order(StaffSeeder.ORDER)
public class StaffSeeder implements ApplicationRunner {

    public static final int ORDER = DatabaseSeeder.ORDER + 50;
    public static final String MARKER = "staff.v1";

    private static final Logger log = LoggerFactory.getLogger(StaffSeeder.class);

    /** One member of the leadership; {@code department} is null for the director. */
    record Staff(String name, String email, String title, String role, String department) {
    }

    static final List<Staff> STAFF = List.of(
            new Staff("Mihnea Gîrbăcică", "mihnea.girbacica@mehstudios.net", "Director",
                    SystemRoles.ADMIN, null),
            new Staff("Andrei-Constantin Ichim", "andrei-constantin.ichim@mehstudios.net", "Head of Administration",
                    SystemRoles.MANAGER, "Administration"),
            new Staff("Luchian Sainenco", "luchian.sainenco@mehstudios.net", "Head of Development",
                    SystemRoles.MANAGER, "Development"),
            new Staff("Mihai-Bruno Tomița", "mihai-bruno.tomita@mehstudios.net", "Head of Quality Control",
                    SystemRoles.MANAGER, "Quality Control"),
            new Staff("Andrei Rădulescu", "andrei.radulescu@mehstudios.net", "Head of Ethics & Regulations",
                    SystemRoles.MANAGER, "Ethics & Regulations"),
            new Staff("Andrei Mitran", "andrei.mitran@mehstudios.net", "Head of Engineering & Innovation",
                    SystemRoles.MANAGER, "Engineering & Innovation"));

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final OrgSettingRepository orgSettingRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;
    private final boolean enabled;

    public StaffSeeder(UserRepository userRepository, RoleRepository roleRepository,
                       DepartmentRepository departmentRepository, OrgSettingRepository orgSettingRepository,
                       PasswordEncoder passwordEncoder, JdbcTemplate jdbcTemplate,
                       PlatformTransactionManager transactionManager,
                       @Value("${app.seed.staff:true}") boolean enabled) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.orgSettingRepository = orgSettingRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (enabled) {
            seed();
        }
    }

    /** Seeds the leadership unless the marker says it already happened. Returns how many accounts were created. */
    public int seed() {
        Integer created = transactionTemplate.execute(status -> {
            jdbcTemplate.queryForList("SELECT pg_advisory_xact_lock(hashtext('msf-seeder'))");
            if (orgSettingRepository.existsById(MARKER)) {
                return 0;
            }
            int count = seedOnce();
            orgSettingRepository.save(OrgSetting.builder()
                    .key(MARKER).value(count + " leadership accounts").updatedAt(LocalDateTime.now()).build());
            log.info("[SEEDER] Leadership accounts added: {}", count);
            return count;
        });
        return created == null ? 0 : created;
    }

    private int seedOnce() {
        Set<String> demoEmails = DemoPeopleSeeder.PEOPLE.stream()
                .map(DemoPeopleSeeder.Person::email).collect(Collectors.toSet());
        int created = 0;
        for (Staff staff : STAFF) {
            Department department = staff.department() == null ? null
                    : departmentRepository.findByNameIgnoreCase(staff.department()).orElse(null);
            User user = userRepository.findByEmailIgnoreCase(staff.email()).orElse(null);
            if (user == null) {
                Role role = roleRepository.findByName(staff.role()).orElseThrow(() ->
                        new IllegalStateException("Role " + staff.role() + " is missing; DatabaseSeeder must run first"));
                user = userRepository.save(User.builder()
                        .fullName(staff.name())
                        .email(staff.email())
                        .title(staff.title())
                        // Nobody knows this password: sign-in starts with a reset link or the Authentik sync.
                        .password(passwordEncoder.encode("x!" + UUID.randomUUID()))
                        .status(User.STATUS_ACTIVE)
                        .department(department)
                        .roles(new HashSet<>(Set.of(role)))
                        .createdAt(LocalDateTime.now())
                        .passwordChangedAt(LocalDateTime.now())
                        .build());
                created++;
            }
            if (department != null && user.isActive() && SystemRoles.isPrivileged(user.getPrimaryRoleName())
                    && user.getDepartment() != null && user.getDepartment().getId().equals(department.getId())) {
                User current = department.getManager();
                if (current == null || demoEmails.contains(current.getEmail())) {
                    department.setManager(user);
                    department.setManagerSource(null);
                    departmentRepository.save(department);
                }
            }
        }
        return created;
    }
}
