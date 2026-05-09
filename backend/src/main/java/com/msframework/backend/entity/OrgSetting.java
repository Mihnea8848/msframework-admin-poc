package com.msframework.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "org_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrgSetting {

    @Id
    private String key;

    @Column(columnDefinition = "TEXT")
    private String value;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
