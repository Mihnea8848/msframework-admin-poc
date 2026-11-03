package com.msframework.backend.controller;

import com.msframework.backend.config.Permission;
import com.msframework.backend.dto.UserCreateRequest;
import com.msframework.backend.dto.UserDto;
import com.msframework.backend.dto.UserUpdateRequest;
import com.msframework.backend.entity.User;
import com.msframework.backend.service.AuthSessionService;
import com.msframework.backend.service.CurrentUserService;
import com.msframework.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final CurrentUserService currentUserService;
    private final UserService userService;
    private final AuthSessionService authSessionService;

    @GetMapping
    public List<UserDto> list(Principal principal) {
        currentUserService.requirePermission(principal, Permission.USER_READ);
        return userService.list();
    }

    @PostMapping
    public ResponseEntity<UserDto> create(@RequestBody UserCreateRequest request, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_CREATE);
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(request, actor));
    }

    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id,
                          @RequestBody UserUpdateRequest request,
                          Principal principal,
                          HttpServletRequest httpRequest,
                          HttpServletResponse httpResponse) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_UPDATE);
        User saved = userService.update(id, request, actor);

        // Admins editing their own email would otherwise lose their session.
        if (saved.getId().equals(actor.getId()) && !saved.getEmail().equals(actor.getEmail())) {
            authSessionService.refreshPrincipal(saved.getEmail(), httpRequest, httpResponse);
        }
        return userService.toDto(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User actor = currentUserService.requirePermission(principal, Permission.USER_DELETE);
        userService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }
}
