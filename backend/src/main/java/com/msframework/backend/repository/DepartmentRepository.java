package com.msframework.backend.repository;

import com.msframework.backend.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    Optional<Department> findByNameIgnoreCase(String name);

    List<Department> findAllByOrderByIdAsc();

    /** All departments with their manager loaded in the same query. */
    @Query("SELECT d FROM Department d LEFT JOIN FETCH d.manager ORDER BY d.id")
    List<Department> findAllWithManager();

    List<Department> findByManagerId(Long managerId);

    /** Rows of [managerUserId, departmentId] for every department that has a manager. */
    @Query("SELECT d.manager.id, d.id FROM Department d WHERE d.manager IS NOT NULL")
    List<Object[]> managerAssignments();
}
