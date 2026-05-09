package com.msframework.backend.repository;

import com.msframework.backend.entity.ServiceConnection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceConnectionRepository extends JpaRepository<ServiceConnection, String> {
}
