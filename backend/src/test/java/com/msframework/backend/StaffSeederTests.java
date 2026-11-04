package com.msframework.backend;

import com.msframework.backend.config.StaffSeeder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The leadership seeder (off in the test profile, so it runs explicitly here). Everything it
 * changes is put back afterwards, because the tests share one database and some of them expect
 * admin@test.com to be the only active admin.
 */
@IntegrationTest
class StaffSeederTests {

    @Autowired
    private StaffSeeder staffSeeder;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void addsTheLeadershipOnceAsHeadsOfTheirDepartments() {
        List<Map<String, Object>> managersBefore = jdbc.queryForList("SELECT id, manager_id, manager_source FROM departments");
        String staff = "email IN ('mihnea.girbacica@mehstudios.net', 'andrei-constantin.ichim@mehstudios.net', "
                + "'luchian.sainenco@mehstudios.net', 'mihai-bruno.tomita@mehstudios.net', "
                + "'andrei.radulescu@mehstudios.net', 'andrei.mitran@mehstudios.net')";
        long existing = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE " + staff, Long.class);
        try {
            int created = staffSeeder.seed();
            assertThat(created + existing).isEqualTo(6);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE " + staff, Long.class)).isEqualTo(6);
            // The director is an admin without a department; the five heads lead theirs.
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id "
                    + "JOIN role r ON r.id = ur.role_id WHERE r.name = 'ADMIN' AND u.department_id IS NULL AND u."
                    + staff, Long.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM departments d JOIN users u ON u.id = d.manager_id "
                    + "WHERE u.department_id = d.id AND u." + staff, Long.class)).isEqualTo(5);

            // Once only: a second run adds nobody.
            assertThat(staffSeeder.seed()).isZero();
        } finally {
            for (Map<String, Object> row : managersBefore) {
                jdbc.update("UPDATE departments SET manager_id = ?, manager_source = ? WHERE id = ?",
                        row.get("manager_id"), row.get("manager_source"), row.get("id"));
            }
            jdbc.update("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE " + staff + ")");
            jdbc.update("DELETE FROM users WHERE " + staff);
            jdbc.update("DELETE FROM org_settings WHERE key = ?", StaffSeeder.MARKER);
        }
    }
}
