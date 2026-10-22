package com.quickerp.core;

import java.util.Map;

/** An error that is returned to the client with an HTTP status and a readable message. */
public class ApiException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final int status;
    private final String code;
    private final transient Map<String, java.util.List<String>> errors;

    public ApiException(int status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(int status, String code, String message, Map<String, java.util.List<String>> errors) {
        super(message);
        this.status = status;
        this.code = code;
        this.errors = errors;
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
}
