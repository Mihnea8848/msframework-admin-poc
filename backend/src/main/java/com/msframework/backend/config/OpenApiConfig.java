package com.msframework.backend.config;

import com.msframework.backend.exception.ErrorResponse;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.servers.Server;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.SpecVersion;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Comparator;

/**
 * The OpenAPI description served at {@code /v3/api-docs} (springdoc). A copy is committed as
 * {@code api/openapi.json} and {@code OpenApiContractTest} fails when the two drift apart.
 *
 * <p>The server URL is pinned to "/" so the description does not depend on the host it was
 * generated on, and tags are sorted so the output is the same on every run.</p>
 */
@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "MSFramework API",
                version = "${app.version}",
                description = "JSON API of the MSFramework admin dashboard. Authentication is a session cookie "
                        + "(SESSION) set by POST /api/auth/login. POST, PUT, PATCH and DELETE also need the "
                        + "X-XSRF-TOKEN header, echoing the XSRF-TOKEN cookie (GET /api/auth/csrf sets it). "
                        + "Every error has the ErrorResponse body."),
        servers = @Server(url = "/"))
public class OpenApiConfig {

    private static final String ERROR_SCHEMA_REF = "#/components/schemas/ErrorResponse";

    /** Documents the {@code ErrorResponse} body on every operation and keeps the tag order stable. */
    @Bean
    OpenApiCustomizer errorResponsesAndStableTags() {
        return openApi -> {
            if (openApi.getComponents() == null) {
                openApi.setComponents(new Components());
            }
            ModelConverters.getInstance(openApi.getSpecVersion() == SpecVersion.V31)
                    .read(ErrorResponse.class)
                    .forEach(openApi.getComponents()::addSchemas);
            if (openApi.getTags() != null) {
                openApi.getTags().sort(Comparator.comparing(Tag::getName));
            }
            if (openApi.getPaths() == null) {
                return;
            }
            openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                operation.getResponses().addApiResponse("4XX", errorResponse(
                        "The request was rejected: invalid input (400), not signed in (401), "
                                + "missing permission or CSRF token (403), not found (404), a conflict (409) or too many "
                                + "attempts (429, with a Retry-After header in seconds). "
                                + "The message is written for the end user."));
                operation.getResponses().addApiResponse("5XX", errorResponse("Unexpected server error"));
            }));
        };
    }

    private static ApiResponse errorResponse(String description) {
        return new ApiResponse()
                .description(description)
                .content(new Content().addMediaType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                        new MediaType().schema(new Schema<>().$ref(ERROR_SCHEMA_REF))));
    }
}
