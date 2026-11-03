package com.msframework.backend.exception;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpStatus;

/** JSON body returned for every error: {"status":403,"error":"Forbidden","message":"..."}. */
@Schema(description = "The body of every error response")
public record ErrorResponse(
        @Schema(description = "The HTTP status code", example = "403", requiredMode = Schema.RequiredMode.REQUIRED)
        int status,

        @Schema(description = "The HTTP reason phrase", example = "Forbidden", requiredMode = Schema.RequiredMode.REQUIRED)
        String error,

        @Schema(description = "What went wrong, written for the end user and shown as-is",
                example = "You do not have permission to do this (USER_DELETE)",
                requiredMode = Schema.RequiredMode.REQUIRED)
        String message
) {

    public static ErrorResponse of(HttpStatusCode code, String message) {
        HttpStatus resolved = HttpStatus.resolve(code.value());
        String reason = resolved != null ? resolved.getReasonPhrase() : "Error";
        return new ErrorResponse(code.value(), reason, message);
    }
}
