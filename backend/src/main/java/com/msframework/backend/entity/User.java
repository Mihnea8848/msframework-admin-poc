package com.msframework.backend.entity;

import com.msframework.backend.config.Permission;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    public static final String STATUS_ACTIVE = "Active";
    public static final String STATUS_INACTIVE = "Inactive";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    private String password;
    private String status;
    private String phone;

    /** Job title, e.g. "Senior Producer". Optional. */
    private String title;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    /** Last successful sign-in, or null when the user never signed in. */
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    /**
     * The directory the account is linked to ("authentik"), or null for a local account. A linked
     * account follows the directory on every sync; a local one is never changed by it.
     */
    @Column(name = "external_source", length = 32)
    private String externalSource;

    /** The account's id in that directory (the Authentik user pk). */
    @Column(name = "external_id", length = 64)
    private String externalId;

    /** The account's user name in that directory, shown to admins. */
    @Column(name = "external_username")
    private String externalUsername;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (passwordChangedAt == null) passwordChangedAt = createdAt;
        if (status == null) status = STATUS_ACTIVE;
    }

    public boolean isActive() {
        return STATUS_ACTIVE.equalsIgnoreCase(status);
    }

    public boolean hasRole(String roleName) {
        return roles.stream().anyMatch(role -> role.getName().equals(roleName));
    }

    public boolean hasPermission(Permission permission) {
        return roles.stream()
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(p -> p == permission);
    }

    public Set<Permission> getAllPermissions() {
        Set<Permission> all = EnumSet.noneOf(Permission.class);
        roles.forEach(role -> all.addAll(role.getPermissions()));
        return all;
    }

    /** The single role shown in the UI (users have exactly one role; the most privileged wins). */
    public String getPrimaryRoleName() {
        for (String name : new String[]{"ADMIN", "MANAGER", "MEMBER", "VIEWER"}) {
            if (hasRole(name)) return name;
        }
        return roles.stream().map(Role::getName).sorted().findFirst().orElse(null);
    }
}
