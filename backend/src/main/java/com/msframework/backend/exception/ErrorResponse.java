package com.msframework.backend.exception;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpStatus;

/** JSON body returned for every error: {"status":403,"error":"Forbidden","message":"..."}. */
public record ErrorResponse(int status, String error, String message) {

    public static ErrorResponse of(HttpStatusCode code, String message) {
        HttpStatus resolved = HttpStatus.resolve(code.value());
        String reason = resolved != null ? resolved.getReasonPhrase() : "Error";
        return new ErrorResponse(code.value(), reason, message);
    }
}
