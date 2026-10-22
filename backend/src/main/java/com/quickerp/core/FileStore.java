package com.quickerp.core;

import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Stores uploaded files in PostgreSQL. Files are read through links that carry a
 * random access key (/files/{id}?key=...), so images can be shown with a normal img tag.
 */
public final class FileStore {

    public record Stored(String id, String path, String fileName, String contentType, long sizeBytes) {
    }

    public record Content(String fileName, String contentType, byte[] bytes, boolean inline) {
    }

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain", "text/csv");
    private static final Set<String> INLINE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf");

    private final Db db;
    private final long maxBytes;

    public FileStore(Db db, long maxBytes) {
        this.db = db;
        this.maxBytes = maxBytes;
    }

    public Stored save(Principal principal, String originalName, String contentType, byte[] bytes) {
        if (bytes == null || bytes.length == 0) throw ApiException.badRequest("The file is empty.");
        if (bytes.length > maxBytes) throw ApiException.badRequest("The file is larger than the allowed " + (maxBytes / (1024 * 1024)) + " MB.");
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT).split(";")[0].trim();
        if (!ALLOWED_TYPES.contains(type)) {
            throw ApiException.badRequest("This file type is not allowed. Use images, PDF, Word, Excel, CSV or text files.");
        }
        String name = originalName == null || originalName.isBlank() ? "file" : originalName.replaceAll("[\\\\/\\r\\n\"]", "_");
        if (name.length() > 255) name = name.substring(name.length() - 255);
        String id = UUID.randomUUID().toString().replace("-", "");
        String key = Hashing.randomToken(24);
        String storedName = name;
        db.tx(connection -> Sql.update(connection,
                "INSERT INTO stored_files (id, tenant_id, file_name, content_type, size_bytes, sha256, access_key, content, created_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id, principal.scopeTenant(), storedName, type, (long) bytes.length, Hashing.sha256(bytes), key, bytes, principal.userId()));
        return new Stored(id, "/files/" + id + "?key=" + key, storedName, type, bytes.length);
    }

    public Content read(String id, String key) {
        if (id == null || key == null || !id.matches("[0-9a-f]{32}")) throw ApiException.notFound("File not found.");
        return db.snapshot(connection -> {
            try (PreparedStatement statement = Sql.prepare(connection,
                    "SELECT file_name, content_type, content, access_key FROM stored_files WHERE id = ?", id);
                 ResultSet rows = statement.executeQuery()) {
                if (!rows.next() || !java.security.MessageDigest.isEqual(
                        rows.getString(4).getBytes(StandardCharsets.US_ASCII), key.getBytes(StandardCharsets.US_ASCII))) {
                    throw ApiException.notFound("File not found.");
                }
                String type = rows.getString(2);
                return new Content(rows.getString(1), type, rows.getBytes(3), INLINE_TYPES.contains(type));
            }
        });
    }
}
