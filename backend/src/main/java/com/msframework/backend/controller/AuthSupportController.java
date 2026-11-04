package com.msframework.backend.controller;

import com.msframework.backend.dto.RegistrationStatusDto;
import com.msframework.backend.service.OrgSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public helpers for the sign-in pages: the CSRF token cookie and whether registration is open. */
@Tag(name = "Auth", description = "Sign-in, registration, password reset and the caller's own account")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthSupportController {

    private final OrgSettingsService orgSettingsService;

    /** Sets the XSRF-TOKEN cookie, which unsafe requests must echo in the X-XSRF-TOKEN header. */
    @Operation(operationId = "primeCsrfToken", summary = "Set the CSRF token cookie",
            description = "Sets the XSRF-TOKEN cookie. Send its value in the X-XSRF-TOKEN header on every POST, "
                    + "PUT, PATCH and DELETE.")
    @ApiResponse(responseCode = "204", description = "Cookie set")
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken(); // loading the deferred token writes the cookie
        return ResponseEntity.noContent().build();
    }

    @Operation(operationId = "getRegistrationStatus", summary = "Whether self-registration is open",
            description = "Public, so the sign-in page can hide \"Sign up\" when it is closed.")
    @GetMapping("/registration")
    public RegistrationStatusDto registration() {
        return new RegistrationStatusDto(orgSettingsService.registrationEnabled(), orgSettingsService.passwordMinLength());
    }
}
