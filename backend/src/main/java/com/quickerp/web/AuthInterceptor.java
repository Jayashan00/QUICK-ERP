package com.quickerp.web;

import com.quickerp.core.ApiException;
import com.quickerp.core.AuthService;
import com.quickerp.core.Principal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Requires a valid bearer token on protected endpoints and exposes the caller to controllers. */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String PRINCIPAL_ATTRIBUTE = AuthInterceptor.class.getName() + ".principal";

    private final AuthService authService;

    public AuthInterceptor(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String header = request.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw ApiException.unauthorized("Sign in to continue.");
        }
        Principal principal = authService.authenticate(header.substring(7).trim());
        request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
        return true;
    }

    public static Principal principal(HttpServletRequest request) {
        Object value = request.getAttribute(PRINCIPAL_ATTRIBUTE);
        if (value instanceof Principal principal) return principal;
        throw ApiException.unauthorized("Sign in to continue.");
    }
}
