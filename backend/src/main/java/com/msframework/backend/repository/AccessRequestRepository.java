package com.msframework.backend.repository;

import com.msframework.backend.entity.AccessRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AccessRequestRepository extends JpaRepository<AccessRequest, Long> {

    List<AccessRequest> findAllByOrderByCreatedAtDescIdDesc();

    List<AccessRequest> findByStatusOrderByCreatedAtDescIdDesc(AccessRequest.Status status);

    long countByStatus(AccessRequest.Status status);

    @Query("SELECT a FROM AccessRequest a WHERE lower(a.email) = lower(:email) AND a.status = :status")
    Optional<AccessRequest> findByEmailAndStatus(@Param("email") String email,
                                                 @Param("status") AccessRequest.Status status);
}
