package com.msframework.backend.service;

import com.msframework.backend.exception.ApiException;

import java.util.regex.Pattern;

/** Validation shared by the department endpoints and the CSV import. */
public final class DepartmentRules {

    public static final String DEFAULT_COLOR = "avatar-azure";

    /** Colours are CSS class names from the frontend palette, e.g. "avatar-rose". */
    private static final Pattern COLOR = Pattern.compile("^avatar-[a-z]{2,20}$");

    private DepartmentRules() {
    }

    public static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw ApiException.badRequest("Department name is required");
        if (name.length() > 60) throw ApiException.badRequest("Department name must be at most 60 characters");
        return name;
    }

    public static String normalizeColor(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT_COLOR;
        String color = raw.trim();
        if (!COLOR.matcher(color).matches()) {
            throw ApiException.badRequest("Invalid colour \"" + color + "\"");
        }
        return color;
    }
}
