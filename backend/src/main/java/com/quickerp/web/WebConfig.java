package com.quickerp.web;

import com.quickerp.config.AppProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final MaintenanceInterceptor maintenanceInterceptor;
    private final SubscriptionMiddleware subscriptionMiddleware;
    private final AppProperties properties;

    public WebConfig(AuthInterceptor authInterceptor, MaintenanceInterceptor maintenanceInterceptor,
                     SubscriptionMiddleware subscriptionMiddleware, AppProperties properties) {
        this.authInterceptor = authInterceptor;
        this.maintenanceInterceptor = maintenanceInterceptor;
        this.subscriptionMiddleware = subscriptionMiddleware;
        this.properties = properties;
    }

    private static final String[] PROTECTED_PATHS = {
            "/auth/me", "/auth/change-password", "/auth/logout", "/auth/logout-all",
            "/auth/mfa", "/auth/mfa/setup", "/auth/mfa/enable", "/auth/mfa/disable",
            "/state", "/state/**", "/users/**", "/platform/**", "/files", "/ai/**",
            "/sales/quotations/**", "/sales/orders/**", "/sales/invoices/**",
            "/sales/deliveries/**", "/sales/credit-notes/**", "/purchases/rfqs/**"
    };

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 1. Auth: resolve and validate the bearer token, store Principal on the request.
        registry.addInterceptor(authInterceptor)
                .addPathPatterns(PROTECTED_PATHS)
                .excludePathPatterns("/platform/maintenance/status");

        // 2. Maintenance guard: reject tenant requests with HTTP 503 while maintenance is active.
        //    Super Admin callers are always allowed through to platform management.
        registry.addInterceptor(maintenanceInterceptor)
                .addPathPatterns(PROTECTED_PATHS)
                .excludePathPatterns("/platform/**", "/platform/maintenance/status");

        // 3. Subscription: block EXPIRED/SUSPENDED tenants from all protected endpoints.
        //    Super Admin callers are always allowed through. Login (/auth/login) is excluded
        //    so users can still sign in and see the subscription-expired screen.
        registry.addInterceptor(subscriptionMiddleware)
                .addPathPatterns("/state", "/state/**", "/files", "/ai/**",
                        "/sales/quotations/**", "/sales/orders/**", "/sales/invoices/**",
                        "/sales/deliveries/**", "/sales/credit-notes/**", "/purchases/rfqs/**")
                .excludePathPatterns("/platform/**"); // Super Admin routes — no subscription check needed
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = properties.getCors().getAllowedOrigins().stream()
                .filter(origin -> origin != null && !origin.isBlank())
                .map(String::trim)
                .toArray(String[]::new);
        registry.addMapping("/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
