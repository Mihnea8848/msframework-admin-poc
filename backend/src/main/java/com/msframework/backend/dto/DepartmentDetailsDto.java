package com.msframework.backend.dto;

import java.util.List;

/** A department with its members, sorted by name. */
public record DepartmentDetailsDto(
        Long id,
        String name,
        String color,
        long memberCount,
        long activeMemberCount,
        Long managerId,
        String managerName,
        List<UserDto> members
) {}
