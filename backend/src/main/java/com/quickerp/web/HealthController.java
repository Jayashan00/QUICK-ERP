package com.quickerp.web;

import com.quickerp.core.Db;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
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
        try {
            db.snapshot(connection -> {
                try (PreparedStatement statement = connection.prepareStatement("SELECT 1"); ResultSet rows = statement.executeQuery()) {
                    return rows.next();
                }
            });
            body.put("status", "ok");
            body.put("database", "up");
            return ResponseEntity.ok(body);
        } catch (RuntimeException error) {
            body.put("status", "degraded");
            body.put("database", "down");
            return ResponseEntity.status(503).body(body);
        }
    }
}
