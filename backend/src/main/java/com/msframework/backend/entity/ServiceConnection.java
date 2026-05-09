package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_connections")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ServiceConnection {

    @Id
    private String serviceId;

    private boolean connected;
    private boolean enabled;

    @Column(name = "connected_at")
    private LocalDateTime connectedAt;
}
