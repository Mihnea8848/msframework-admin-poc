package com.msframework.backend.repository;

import com.msframework.backend.entity.GoalCheckin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface GoalCheckinRepository extends JpaRepository<GoalCheckin, Long> {

    List<GoalCheckin> findByGoalIdOrderByDateDescIdDesc(Long goalId);

    List<GoalCheckin> findByGoalIdIn(Collection<Long> goalIds);

    long countByGoalId(Long goalId);
}
