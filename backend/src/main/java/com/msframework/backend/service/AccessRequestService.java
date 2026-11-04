package com.msframework.backend.service;

import com.msframework.backend.config.SystemRoles;
import com.msframework.backend.dto.AccessRequestApproveRequest;
import com.msframework.backend.dto.AccessRequestDto;
import com.msframework.backend.dto.RegisterRequest;
import com.msframework.backend.entity.AccessRequest;
import com.msframework.backend.entity.Department;
import com.msframework.backend.entity.Role;
import com.msframework.backend.entity.User;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.AccessRequestRepository;
import com.msframework.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Self-registration creates an access request instead of an account. An administrator approves it
 * (the account is created with the password the person chose) or rejects it.
 */
@Service
@RequiredArgsConstructor
public class AccessRequestService {

    public static final String SUBMITTED_MESSAGE = "Your request was sent. An administrator will review it.";
    public static final String PENDING_LOGIN_MESSAGE =
            "Your access request is still waiting for approval. You can sign in once an administrator approves it.";
    private static final int MAX_NOTE = 500;

    private final AccessRequestRepository accessRequestRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final AuditService auditService;

    @Transactional
    public AccessRequest submit(RegisterRequest request) {
        String fullName = UserService.requireFullName(request.fullName());
        String email = UserService.requireValidEmail(request.email());
        String phone = UserService.normalizePhone(request.phone(), true);
        passwordPolicy.validate(request.password());
        Department department = userService.findDepartment(request.departmentId());

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with this email already exists. Sign in, or reset your password "
                    + "if you forgot it.");
        }
        if (accessRequestRepository.findByEmailAndStatus(email, AccessRequest.Status.PENDING).isPresent()) {
            throw ApiException.conflict("A request for this email is already waiting for approval.");
        }

        AccessRequest saved;
        try {
            saved = accessRequestRepository.saveAndFlush(AccessRequest.builder()
                    .fullName(fullName)
                    .email(email)
                    .phone(phone)
                    .department(department)
                    .passwordHash(passwordEncoder.encode(request.password()))
                    .status(AccessRequest.Status.PENDING)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // Two submissions at the same moment: the partial unique index lets only one through.
            throw ApiException.conflict("A request for this email is already waiting for approval.");
        }
        auditService.log("access_requested", email, fullName + " asked for access"
                        + (department != null ? " to " + department.getName() : ""),
                AuditService.Subject.department(department != null ? department.getId() : null));
        return saved;
    }

    /**
     * The message for a failed sign-in whose email has a pending request and whose password matches
     * it, so the person learns why they cannot sign in yet. Empty otherwise (a wrong password reveals
     * nothing).
     */
    @Transactional(readOnly = true)
    public Optional<String> pendingSignInMessage(String email, String password) {
        if (email == null || email.isBlank() || password == null) return Optional.empty();
        return accessRequestRepository.findByEmailAndStatus(email, AccessRequest.Status.PENDING)
                .filter(r -> r.getPasswordHash() != null && passwordEncoder.matches(password, r.getPasswordHash()))
                .map(r -> PENDING_LOGIN_MESSAGE);
    }

    @Transactional(readOnly = true)
    public List<AccessRequestDto> list(String status) {
        List<AccessRequest> requests;
        if (status == null || status.isBlank()) {
            requests = accessRequestRepository.findAllByOrderByCreatedAtDescIdDesc();
        } else {
            requests = accessRequestRepository.findByStatusOrderByCreatedAtDescIdDesc(parseStatus(status));
        }
        return requests.stream().map(AccessRequestService::toDto).toList();
    }

    @Transactional
    public AccessRequestDto approve(Long id, AccessRequestApproveRequest body, User actor) {
        AccessRequest request = requirePending(id);
        Role role = userService.requireRole(body != null ? body.role() : null);
        if (!actor.hasRole(SystemRoles.ADMIN) && SystemRoles.isPrivileged(role.getName())) {
            throw ApiException.forbidden("Only admins can assign the ADMIN or MANAGER role");
        }
        Department department = body != null && body.departmentId() != null
                ? userService.findDepartment(body.departmentId())
                : request.getDepartment();
        if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw ApiException.conflict("An account with " + request.getEmail()
                    + " already exists. Reject this request instead.");
        }
        if (request.getPasswordHash() == null) {
            throw ApiException.conflict("This request has no password. Reject it and ask the person to register again.");
        }

        User user = userRepository.save(User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail().toLowerCase(Locale.ROOT))
                .phone(request.getPhone())
                .password(request.getPasswordHash())
                .status(User.STATUS_ACTIVE)
                .department(department)
                .roles(new HashSet<>(Set.of(role)))
                .build());

        request.setStatus(AccessRequest.Status.APPROVED);
        request.setDecidedBy(actor.getEmail());
        request.setDecidedAt(LocalDateTime.now());
        request.setUserId(user.getId());
        request.setPasswordHash(null);
        AccessRequest saved = accessRequestRepository.save(request);

        auditService.log("access_approved", actor.getEmail(),
                "Approved access for " + user.getFullName() + " (" + user.getEmail() + ") as " + role.getName()
                        + (department != null ? " in " + department.getName() : ""),
                new AuditService.Subject(user.getId(), department != null ? department.getId() : null));
        return toDto(saved);
    }

    @Transactional
    public AccessRequestDto reject(Long id, String rawNote, User actor) {
        AccessRequest request = requirePending(id);
        String note = rawNote == null || rawNote.isBlank() ? null : rawNote.trim();
        if (note != null && note.length() > MAX_NOTE) {
            throw ApiException.badRequest("The note must be at most " + MAX_NOTE + " characters");
        }

        request.setStatus(AccessRequest.Status.REJECTED);
        request.setDecidedBy(actor.getEmail());
        request.setDecidedAt(LocalDateTime.now());
        request.setNote(note);
        request.setPasswordHash(null);
        AccessRequest saved = accessRequestRepository.save(request);

        auditService.log("access_rejected", actor.getEmail(),
                "Rejected access for " + request.getFullName() + " (" + request.getEmail() + ")"
                        + (note != null ? ": " + note : ""),
                AuditService.Subject.department(request.getDepartment() != null ? request.getDepartment().getId() : null));
        return toDto(saved);
    }

    private AccessRequest requirePending(Long id) {
        AccessRequest request = accessRequestRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Access request not found"));
        if (request.getStatus() != AccessRequest.Status.PENDING) {
            throw ApiException.conflict("This request was already " + request.getStatus().name().toLowerCase(Locale.ROOT)
                    + (request.getDecidedBy() != null ? " by " + request.getDecidedBy() : ""));
        }
        return request;
    }

    private static AccessRequest.Status parseStatus(String raw) {
        try {
            return AccessRequest.Status.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Status must be PENDING, APPROVED or REJECTED");
        }
    }

    public static AccessRequestDto toDto(AccessRequest r) {
        Department department = r.getDepartment();
        return new AccessRequestDto(
                r.getId(),
                r.getFullName(),
                r.getEmail(),
                r.getPhone(),
                department != null ? department.getId() : null,
                department != null ? department.getName() : null,
                r.getStatus(),
                Times.toOffset(r.getCreatedAt()),
                r.getDecidedBy(),
                Times.toOffset(r.getDecidedAt()),
                r.getNote(),
                r.getUserId());
    }
}
