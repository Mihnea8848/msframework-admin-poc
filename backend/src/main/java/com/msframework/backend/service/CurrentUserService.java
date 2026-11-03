package com.msframework.backend.service;

import com.msframework.backend.config.Permission;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.Principal;
import java.util.Optional;

/**
 * Resolves the signed-in user from the session principal and enforces permissions. Roles are read
 * from the database on every call, so role changes and deactivations apply immediately.
 */
@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository userRepository;

    public Optional<User> find(Principal principal) {
        if (principal == null) return Optional.empty();
        return userRepository.findByEmailIgnoreCase(principal.getName());
    }

    public User require(Principal principal) {
        if (principal == null) {
            throw ApiException.unauthorized("Not authenticated");
        }
        User user = find(principal).orElseThrow(() ->
                ApiException.unauthorized("Your session is no longer valid. Please sign in again."));
        if (!user.isActive()) {
            throw ApiException.unauthorized("Your account is inactive. Contact an administrator.");
        }
        return user;
    }

    public User requirePermission(Principal principal, Permission... permissions) {
        User user = require(principal);
        for (Permission permission : permissions) {
            if (!user.hasPermission(permission)) {
                throw ApiException.forbidden("You do not have permission to do this (" + permission + ")");
            }
        }
        return user;
    }
}
