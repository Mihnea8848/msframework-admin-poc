package com.msframework.backend.service;

import com.msframework.backend.entity.User;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsPasswordService;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads accounts for Spring Security's sign-in, and stores a re-hashed password when a stored
 * hash is weaker than the current BCrypt strength (Spring calls {@link #updatePassword} after a
 * successful sign-in). Re-hashing is not a password change, so {@code password_changed_at} stays.
 */
@Service
@RequiredArgsConstructor
public class AccountDetailsService implements UserDetailsService, UserDetailsPasswordService {

    private static final Logger log = LoggerFactory.getLogger(AccountDetailsService.class);

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        // Account status is checked after the password, in AuthController, so that the
        // "inactive" state is never revealed to someone who does not know the password.
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword() == null ? "" : user.getPassword())
                .roles("USER")
                .build();
    }

    @Override
    @Transactional
    public UserDetails updatePassword(UserDetails details, String newEncodedPassword) {
        userRepository.findByEmailIgnoreCase(details.getUsername()).ifPresent(user -> {
            user.setPassword(newEncodedPassword);
            userRepository.save(user);
            log.info("Upgraded the password hash of {} to the current BCrypt strength", user.getEmail());
        });
        return org.springframework.security.core.userdetails.User.withUserDetails(details)
                .password(newEncodedPassword)
                .build();
    }
}
