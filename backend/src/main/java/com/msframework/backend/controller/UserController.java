package com.msframework.backend.controller;

import com.msframework.backend.entity.User;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping
    public List<User> getAllUsers(Principal principal) {
        System.out.println("[USER_CONTROLLER] Fetching users for: " + (principal != null ? principal.getName() : "Anonymous"));
        return userRepository.findAll();
    }
}