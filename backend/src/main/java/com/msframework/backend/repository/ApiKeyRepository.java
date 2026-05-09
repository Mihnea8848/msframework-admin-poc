package com.msframework.backend.repository;

import com.msframework.backend.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {
}
