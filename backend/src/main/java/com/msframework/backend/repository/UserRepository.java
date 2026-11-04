package com.msframework.backend.repository;

import com.msframework.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    /** Uses the unique index on lower(email) (V3). */
    @Query("SELECT u FROM User u WHERE lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoreCase(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE lower(u.email) = lower(:email)")
    boolean existsByEmailIgnoreCase(@Param("email") String email);

    List<User> findAllByOrderByIdAsc();

    List<User> findByDepartmentIdOrderByFullNameAscIdAsc(Long departmentId);

    @Query("SELECT COUNT(u) FROM User u WHERE u.department.id = :deptId")
    long countByDepartmentId(@Param("deptId") Long deptId);

    /** Rows of [departmentId, memberCount] for every department that has members. */
    @Query("SELECT u.department.id, COUNT(u) FROM User u WHERE u.department IS NOT NULL GROUP BY u.department.id")
    List<Object[]> countMembersPerDepartment();

    @Query("SELECT COUNT(DISTINCT u) FROM User u JOIN u.roles r WHERE r.name = :roleName AND LOWER(u.status) = 'active'")
    long countActiveWithRole(@Param("roleName") String roleName);

    /** Rows of [roleName, members, activeMembers]. */
    @Query("SELECT r.name, COUNT(u), SUM(CASE WHEN LOWER(u.status) = 'active' THEN 1 ELSE 0 END) "
            + "FROM User u JOIN u.roles r GROUP BY r.name")
    List<Object[]> countMembersPerRole();

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE User u SET u.department = NULL WHERE u.department.id = :deptId")
    int unassignDepartment(@Param("deptId") Long deptId);

    @Transactional
    @Modifying
    @Query("UPDATE User u SET u.lastLoginAt = :at WHERE u.id = :id")
    int touchLastLogin(@Param("id") Long id, @Param("at") LocalDateTime at);
}
