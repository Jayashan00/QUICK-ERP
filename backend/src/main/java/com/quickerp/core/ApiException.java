package com.quickerp.core;

import java.util.Map;

/** An error that is returned to the client with an HTTP status and a readable message. */
public class ApiException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final int status;
    private final String code;
    private final transient Map<String, java.util.List<String>> errors;
    private final transient Map<String, Object> details;

    public ApiException(int status, String code, String message) {
        this(status, code, message, null, null);
    }

    public ApiException(int status, String code, String message, Map<String, java.util.List<String>> errors) {
        this(status, code, message, errors, null);
    }

    public ApiException(int status, String code, String message, Map<String, java.util.List<String>> errors, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = errors;
        this.details = details;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Map<String, java.util.List<String>> getErrors() {
        return errors;
    }

    public Map<String, Object> getDetails() {
        return details;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, "bad_request", message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(401, "unauthorized", message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, "forbidden", message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, "not_found", message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, "conflict", message);
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(422, "validation_failed", message, Map.of(field, java.util.List.of(message)));
    }

    public static ApiException tooManyRequests(String message) {
        return new ApiException(429, "too_many_requests", message);
    }

    public static ApiException serviceUnavailable(String code, String message) {
        return new ApiException(503, code, message);
    }

    public static ApiException platformMaintenance(String message, String startAt, String endAt) {
        Map<String, Object> details = new java.util.LinkedHashMap<>();
        if (startAt != null) {
            details.put("expectedStartTime", startAt);
            details.put("startAt", startAt);
        }
        if (endAt != null) {
            details.put("expectedEndTime", endAt);
            details.put("endAt", endAt);
        }
        return new ApiException(503, "PLATFORM_MAINTENANCE", message, null, details);
    }
}
