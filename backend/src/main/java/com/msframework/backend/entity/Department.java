package com.msframework.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity
@Table(name = "departments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = true)
    private String color;

    /**
     * The head of the department: an active member of it with the MANAGER or ADMIN role. Cleared by
     * the database when the user is deleted, and by UserService when they leave or lose the role.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    /**
     * "authentik" when the directory sync chose {@link #manager}, null when a person did. The sync
     * only replaces a manager it set itself.
     */
    @Column(name = "manager_source", length = 32)
    private String managerSource;

    @OneToMany(mappedBy = "department")
    @JsonIgnore
    private List<User> users;
}