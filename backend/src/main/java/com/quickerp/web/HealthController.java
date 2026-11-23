package com.quickerp.web;

import com.quickerp.core.Db;
import java.lang.management.ManagementFactory;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final Db db;

    public HealthController(Db db) {
        this.db = db;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        long dbStart = System.currentTimeMillis();
        boolean dbUp = false;
        long dbLatency = 0;

        try {
            db.snapshot(connection -> {
                try (PreparedStatement statement = connection.prepareStatement("SELECT 1");
                     ResultSet rows = statement.executeQuery()) {
                    return rows.next();
                }
            });
            dbLatency = System.currentTimeMillis() - dbStart;
            dbUp = true;
        } catch (Exception ignored) {
            dbUp = false;
        }

        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
        Runtime runtime = Runtime.getRuntime();
        long usedMemoryMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
        long maxMemoryMb = runtime.maxMemory() / (1024 * 1024);

        body.put("status", dbUp ? "operational" : "degraded");
        body.put("database", dbUp ? "up" : "down");
        body.put("databaseLatencyMs", dbLatency);
        body.put("uptimeSeconds", uptimeSeconds);
        body.put("timestamp", Instant.now().toString());

        Map<String, Object> memory = new LinkedHashMap<>();
        memory.put("usedMb", usedMemoryMb);
        memory.put("maxMb", maxMemoryMb);
        body.put("memory", memory);

        return ResponseEntity.status(dbUp ? 200 : 503).body(body);
    }
}
