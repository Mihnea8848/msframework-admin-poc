package com.msframework.backend.repository;

import com.msframework.backend.entity.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, Long> {

    Optional<ExpenseCategory> findByNameIgnoreCase(String name);

    List<ExpenseCategory> findAllByOrderByNameAsc();
}
