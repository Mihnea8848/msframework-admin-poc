package com.msframework.backend.repository;

import com.msframework.backend.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends JpaRepository<Budget, Long> {

    @Query("SELECT b FROM Budget b WHERE b.year BETWEEN :fromYear AND :toYear")
    List<Budget> findByYearBetween(@Param("fromYear") int fromYear, @Param("toYear") int toYear);

    @Query("SELECT b FROM Budget b WHERE b.department.id = :departmentId AND b.category.id = :categoryId "
            + "AND b.year = :year AND b.quarter = :quarter")
    Optional<Budget> findLine(@Param("departmentId") Long departmentId, @Param("categoryId") Long categoryId,
                              @Param("year") int year, @Param("quarter") int quarter);

    long countByCategoryId(Long categoryId);
}
