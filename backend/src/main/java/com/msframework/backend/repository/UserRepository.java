package com.msframework.backend.repository;

import com.msframework.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findAllByOrderByIdAsc();

    @Query("SELECT COUNT(u) FROM User u WHERE u.department.id = :deptId")
    long countByDepartmentId(@Param("deptId") Long deptId);

    /** Rows of [departmentId, memberCount] for every department that has members. */
    @Query("SELECT u.department.id, COUNT(u) FROM User u WHERE u.department IS NOT NULL GROUP BY u.department.id")
    List<Object[]> countMembersPerDepartment();

    @Query("SELECT COUNT(DISTINCT u) FROM User u JOIN u.roles r WHERE r.name = :roleName AND LOWER(u.status) = 'active'")
    long countActiveWithRole(@Param("roleName") String roleName);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE User u SET u.department = NULL WHERE u.department.id = :deptId")
    int unassignDepartment(@Param("deptId") Long deptId);
}
