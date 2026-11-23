package com.quickerp.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.ApiException;
import com.quickerp.core.Principal;
import com.quickerp.core.Sql;
import com.quickerp.core.SubscriptionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Runs after {@link AuthInterceptor} and enforces the tenant's subscription status.
 * Super Admin callers are always allowed through. Suspended and expired tenants
 * receive a 403 with a human-readable message.
 */
@Component
public class SubscriptionMiddleware implements HandlerInterceptor {

    private final DataSource dataSource;
    private final ObjectMapper mapper;

    public SubscriptionMiddleware(DataSource dataSource, ObjectMapper mapper) {
        this.dataSource = dataSource;
        this.mapper = mapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        Object attr = request.getAttribute(AuthInterceptor.PRINCIPAL_ATTRIBUTE);
        if (!(attr instanceof Principal principal)) return true; // AuthInterceptor handles unauthorized

        if (principal.superAdmin()) return true; // Super Admin always gets through

        // For tenant routes, fetch the tenant profile and enforce subscription
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "SELECT profile FROM tenants WHERE id = ?")) {
            stmt.setString(1, principal.tenantId());
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    JsonNode profile = Sql.readJson(mapper, rs.getString(1));
                    SubscriptionService.enforce(principal, profile);
                }
            }
        }
        return true;
    }
}
