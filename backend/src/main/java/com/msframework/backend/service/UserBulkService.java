package com.msframework.backend.service;

import com.msframework.backend.dto.BulkUserRequest;
import com.msframework.backend.dto.BulkUserResult;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/**
 * Applies one action to several users. Each user goes through {@link UserService#update} in its own
 * transaction, so every rule (last admin, self-protection, manager scope) applies per user, one
 * failure does not undo the others, and each change is audited on its own.
 */
@Service
@RequiredArgsConstructor
public class UserBulkService {

    public static final int MAX_IDS = 200;

    private final UserService userService;
    private final UserRepository userRepository;

    public BulkUserResult apply(BulkUserRequest request, User actor) {
        if (request.action() == null) {
            throw ApiException.badRequest("Choose an action: ACTIVATE, DEACTIVATE, SET_ROLE or SET_DEPARTMENT");
        }
        if (request.ids() == null || request.ids().isEmpty()) {
            throw ApiException.badRequest("Select at least one user");
        }
        List<Long> ids = new ArrayList<>(new LinkedHashSet<>(request.ids().stream().filter(Objects::nonNull).toList()));
        if (ids.isEmpty()) {
            throw ApiException.badRequest("Select at least one user");
        }
        if (ids.size() > MAX_IDS) {
            throw ApiException.badRequest("At most " + MAX_IDS + " users can be changed at once");
        }
        String role = null;
        if (request.action() == BulkUserRequest.Action.SET_ROLE) {
            if (request.role() == null || request.role().isBlank()) {
                throw ApiException.badRequest("Choose a role");
            }
            role = userService.requireRole(request.role()).getName();
        }
        if (request.action() == BulkUserRequest.Action.SET_DEPARTMENT) {
            userService.findDepartment(request.departmentId());
        }

        List<BulkUserResult.Item> results = new ArrayList<>();
        int succeeded = 0;
        for (Long id : ids) {
            try {
                User target = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
                UserUpdateRequest current = UserService.currentValues(target);
                UserUpdateRequest changed = switch (request.action()) {
                    case ACTIVATE -> withStatus(current, User.STATUS_ACTIVE);
                    case DEACTIVATE -> withStatus(current, User.STATUS_INACTIVE);
                    case SET_ROLE -> new UserUpdateRequest(current.fullName(), current.email(), null, role,
                            current.status(), current.departmentId(), null);
                    case SET_DEPARTMENT -> new UserUpdateRequest(current.fullName(), current.email(), null,
                            current.role(), current.status(), request.departmentId(), null);
                };
                User saved = userService.update(id, changed, actor);
                results.add(new BulkUserResult.Item(id, true, null, userService.toDto(saved)));
                succeeded++;
            } catch (ApiException e) {
                results.add(new BulkUserResult.Item(id, false, e.getMessage(), null));
            }
        }
        return new BulkUserResult(succeeded, results.size() - succeeded, results);
    }

    private static UserUpdateRequest withStatus(UserUpdateRequest current, String status) {
        return new UserUpdateRequest(current.fullName(), current.email(), null, current.role(), status,
                current.departmentId(), null);
    }
}
