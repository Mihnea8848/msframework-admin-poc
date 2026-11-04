package com.msframework.backend.controller;

import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.dto.IngestDtos;
import com.msframework.backend.service.IngestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Machine-to-machine ingest. Authentication is an API key, checked by IngestSecurityConfig before
 * the request gets here; there is no session.
 */
@Tag(name = "Ingest", description = "Metric ingest for integrations, authenticated with an API key")
@RestController
@RequestMapping("/api/ingest")
@RequiredArgsConstructor
public class IngestController {

    private final IngestService ingestService;

    @Operation(operationId = "ingestCheckins", summary = "Record goal check-ins from an integration",
            description = "Send Authorization: Bearer <API key>; the key needs the ingest:checkins scope (401 without "
                    + "a valid key, 403 without the scope, 429 above the per-key rate limit). No session cookie is "
                    + "used or created. Invalid items are skipped and reported by their 1-based position; the others "
                    + "are stored with source API.")
    @PostMapping("/checkins")
    public ImportResult checkins(@RequestBody IngestDtos.CheckinsRequest request,
                                 @Parameter(hidden = true) Authentication authentication) {
        return ingestService.ingestCheckins(request, (IngestService.KeyPrincipal) authentication.getPrincipal());
    }
}
