package com.msframework.backend.service;

import com.msframework.backend.dto.ImportResult;
import com.msframework.backend.dto.IngestDtos;
import com.msframework.backend.entity.ApiKey;
import com.msframework.backend.entity.Goal;
import com.msframework.backend.entity.GoalCheckin;
import com.msframework.backend.exception.ApiException;
import com.msframework.backend.repository.ApiKeyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Check-ins pushed by integrations (CI, uptime monitors, an HR system...) through
 * {@code POST /api/ingest/checkins} with an API key that has the {@code ingest:checkins} scope.
 * Each key may send a limited number of requests per minute (in memory, per instance).
 */
@Service
public class IngestService {

    public static final String SCOPE_CHECKINS = "ingest:checkins";
    public static final int MAX_ITEMS = 500;
    private static final DateTimeFormatter LAST_USED = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final GoalService goalService;
    private final ApiKeyRepository apiKeyRepository;
    private final AuditService auditService;
    private final int requestsPerMinute;
    private final Map<Long, Window> windows = new ConcurrentHashMap<>();

    public IngestService(GoalService goalService, ApiKeyRepository apiKeyRepository, AuditService auditService,
                         @Value("${app.ingest.requests-per-minute:60}") int requestsPerMinute) {
        this.goalService = goalService;
        this.apiKeyRepository = apiKeyRepository;
        this.auditService = auditService;
        this.requestsPerMinute = requestsPerMinute;
    }

    /** The key a request authenticated with (set by ApiKeyAuthenticationFilter). */
    public record KeyPrincipal(Long id, String name) {
        public String actor() {
            return "API key: " + name;
        }
    }

    private record Window(long minute, int count) {}

    @Transactional
    public ImportResult ingestCheckins(IngestDtos.CheckinsRequest request, KeyPrincipal key) {
        throttle(key.id());
        List<IngestDtos.Item> items = request == null ? null : request.checkins();
        if (items == null || items.isEmpty()) throw ApiException.badRequest("Send at least one check-in");
        if (items.size() > MAX_ITEMS) throw ApiException.badRequest("Too many check-ins (maximum " + MAX_ITEMS + " per request)");

        List<ImportResult.RowError> errors = new ArrayList<>();
        int created = 0;
        for (int i = 0; i < items.size(); i++) {
            IngestDtos.Item item = items.get(i);
            try {
                if (item == null) throw ApiException.badRequest("Empty check-in");
                Goal goal = goalService.requireGoal(item.goalId());
                goalService.record(goal, item.date(), item.value(), item.note(), GoalCheckin.Source.API, null, key.actor());
                created++;
            } catch (ApiException e) {
                errors.add(new ImportResult.RowError(i + 1, e.getMessage()));
            }
        }

        apiKeyRepository.findById(key.id()).ifPresent(k -> touch(k));
        auditService.log("checkins_ingested", key.actor(),
                "Ingested " + created + " check-in(s) through the API (" + errors.size() + " rejected)");
        return new ImportResult(created, errors.size(), errors);
    }

    private void touch(ApiKey key) {
        key.setLastUsed(LocalDateTime.now().format(LAST_USED));
        apiKeyRepository.save(key);
    }

    /** A fixed one-minute window per key. */
    private void throttle(Long keyId) {
        long minute = System.currentTimeMillis() / 60_000;
        Window window = windows.compute(keyId, (id, w) ->
                w == null || w.minute() != minute ? new Window(minute, 1) : new Window(minute, w.count() + 1));
        if (window.count() > requestsPerMinute) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many requests for this API key. Try again in a minute.");
        }
        if (windows.size() > 10_000) windows.entrySet().removeIf(e -> e.getValue().minute() != minute);
    }
}
