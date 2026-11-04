package com.msframework.backend.repository;

import com.msframework.backend.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GoalRepository extends JpaRepository<Goal, Long> {

    @Query("SELECT g FROM Goal g WHERE g.year = :year AND g.quarter = :quarter ORDER BY g.department.id, g.id")
    List<Goal> findByPeriod(@Param("year") int year, @Param("quarter") int quarter);

    @Query("SELECT g FROM Goal g WHERE g.department.id = :departmentId AND LOWER(g.name) = LOWER(:name) "
            + "ORDER BY g.year DESC, g.quarter DESC, g.id DESC")
    List<Goal> findByDepartmentAndName(@Param("departmentId") Long departmentId, @Param("name") String name);
}
