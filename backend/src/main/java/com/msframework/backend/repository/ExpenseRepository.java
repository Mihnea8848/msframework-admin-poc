package com.msframework.backend.repository;

import com.msframework.backend.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    long countByCategoryId(Long categoryId);
}
