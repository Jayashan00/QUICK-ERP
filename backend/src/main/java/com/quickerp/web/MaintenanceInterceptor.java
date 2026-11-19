package com.quickerp.web;

import com.quickerp.core.ApiException;
import com.quickerp.core.MaintenanceService;
import com.quickerp.core.Principal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Centralized backend maintenance mode guard.
 * Blocks all tenant users and tenant administrators with HTTP 503 Service Unavailable
 * and code PLATFORM_MAINTENANCE when maintenance mode is active.
 *
 * Super Admin users retain full access to all platform management APIs.
 */
@Component
public class MaintenanceInterceptor implements HandlerInterceptor {

    private final MaintenanceService maintenanceService;

    public MaintenanceInterceptor(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;

        // If maintenance is not currently active, let request proceed
        if (!maintenanceService.isMaintenanceActive()) {
            return true;
        }

        String uri = request.getRequestURI();
        // Allow public status and health endpoints
        if (uri.endsWith("/platform/maintenance/status") || uri.endsWith("/health") || uri.contains("/public/")) {
            return true;
        }

        // Check if caller is authenticated as Super Admin
        Object attr = request.getAttribute(AuthInterceptor.PRINCIPAL_ATTRIBUTE);
        if (attr instanceof Principal principal) {
            if (principal.superAdmin()) {
                return true; // Super Admin retains full access to platform management
            }
        }

        // Block tenant admins and all tenant users with HTTP 503 Service Unavailable
        MaintenanceService.MaintenanceConfig config = maintenanceService.getConfig();
        throw ApiException.platformMaintenance(config.message(), config.startAt(), config.endAt());
    }
}
