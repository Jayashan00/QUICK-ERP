package com.quickerp.web;

import com.quickerp.core.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Returns errors in the format the frontend ApiError expects: { status, message, code, errors }. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException error) {
        return body(error.getStatus(), error.getCode(), error.getMessage(), error.getErrors());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof RequestSizeFilter.PayloadTooLargeException) {
                return body(413, "payload_too_large", "The request is too large.", null);
            }
        }
        return body(400, "bad_request", "The request could not be read.", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMediaType(HttpMediaTypeNotSupportedException error) {
        return body(415, "unsupported_media_type", "Send the request body as JSON.", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethod(HttpRequestMethodNotSupportedException error) {
        return body(405, "method_not_allowed", "This method is not supported for this address.", null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoResourceFoundException error) {
        return body(404, "not_found", "The requested address does not exist.", null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleUploadSize(MaxUploadSizeExceededException error) {
        return body(413, "payload_too_large", "The file is larger than the allowed size.", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception error) {
        log.error("Unexpected server error", error);
        return body(500, "server_error", "An unexpected server error occurred. Try again or contact support.", null);
    }

    private static ResponseEntity<Map<String, Object>> body(int status, String code, String message, Object errors) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", status);
        payload.put("code", code);
        payload.put("message", message);
        if (errors != null) payload.put("errors", errors);
        return ResponseEntity.status(status).body(payload);
    }
}
