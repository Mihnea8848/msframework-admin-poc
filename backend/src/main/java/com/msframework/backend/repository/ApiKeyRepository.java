package com.msframework.backend.repository;

import com.msframework.backend.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    List<ApiKey> findAllByOrderByCreatedAtDesc();
}
