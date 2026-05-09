package com.msframework.backend.repository;

import com.msframework.backend.entity.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    List<AuditEvent> findTop50ByOrderByCreatedAtDesc();
}
