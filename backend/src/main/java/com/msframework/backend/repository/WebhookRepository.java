package com.msframework.backend.repository;

import com.msframework.backend.entity.Webhook;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookRepository extends JpaRepository<Webhook, Long> {
}
