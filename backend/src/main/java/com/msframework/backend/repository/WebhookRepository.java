package com.msframework.backend.repository;

import com.msframework.backend.entity.Webhook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WebhookRepository extends JpaRepository<Webhook, Long> {

    List<Webhook> findAllByOrderByCreatedAtDesc();
}
