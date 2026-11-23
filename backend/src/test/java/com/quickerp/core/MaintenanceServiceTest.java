package com.quickerp.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.web.MaintenanceInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

public class MaintenanceServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // Subclass of MaintenanceService for deterministic unit testing without a live PostgreSQL database
    private static class TestableMaintenanceService extends MaintenanceService {
        private MaintenanceConfig currentConfig;

        TestableMaintenanceService(ObjectMapper mapper, MaintenanceConfig initial) {
            super(null, mapper);
            this.currentConfig = initial;
        }

        void setConfig(MaintenanceConfig config) {
            this.currentConfig = config;
        }

        @Override
        public MaintenanceConfig getConfig() {
            return computeActive(currentConfig);
        }

        @Override
        public boolean isMaintenanceActive() {
            return getConfig().active();
        }
    }

    @Test
    void testDisabledMaintenanceIsNotActive() {
        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                false, false, "System upgrade in progress.", null, null, Instant.now().toString(), "admin@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);

        assertFalse(service.isMaintenanceActive());
        MaintenanceService.MaintenanceConfig config = service.getConfig();
        assertFalse(config.enabled());
        assertFalse(config.active());
        assertEquals("System upgrade in progress.", config.message());
    }

    @Test
    void testEnabledImmediateMaintenanceIsActive() {
        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, true, "Platform maintenance in progress.", null, null, Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);

        assertTrue(service.isMaintenanceActive());
        MaintenanceService.MaintenanceConfig config = service.getConfig();
        assertTrue(config.enabled());
        assertTrue(config.active());
    }

    @Test
    void testScheduledFutureMaintenanceIsNotActiveYet() {
        Instant futureStart = Instant.now().plus(2, ChronoUnit.HOURS);
        Instant futureEnd = Instant.now().plus(4, ChronoUnit.HOURS);

        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, false, "Scheduled maintenance.", futureStart.toString(), futureEnd.toString(),
                Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);

        assertFalse(service.isMaintenanceActive(), "Future scheduled maintenance should not be actively blocking yet");
        MaintenanceService.MaintenanceConfig config = service.getConfig();
        assertTrue(config.enabled(), "Should remain marked as enabled/scheduled");
        assertFalse(config.active(), "Should not be active before start time");
    }

    @Test
    void testScheduledCurrentMaintenanceIsActive() {
        Instant pastStart = Instant.now().minus(30, ChronoUnit.MINUTES);
        Instant futureEnd = Instant.now().plus(90, ChronoUnit.MINUTES);

        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, false, "Active window maintenance.", pastStart.toString(), futureEnd.toString(),
                Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);

        assertTrue(service.isMaintenanceActive(), "Maintenance within active window should block tenant traffic");
        MaintenanceService.MaintenanceConfig config = service.getConfig();
        assertTrue(config.active());
    }

    @Test
    void testScheduledPastMaintenanceIsInactive() {
        Instant pastStart = Instant.now().minus(2, ChronoUnit.HOURS);
        Instant pastEnd = Instant.now().minus(30, ChronoUnit.MINUTES);

        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, false, "Expired window maintenance.", pastStart.toString(), pastEnd.toString(),
                Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);

        assertFalse(service.isMaintenanceActive(), "Maintenance window that ended in the past should not be active");
        MaintenanceService.MaintenanceConfig config = service.getConfig();
        assertFalse(config.active());
    }

    @Test
    void testMaintenanceInterceptorAllowsSuperAdminAndBlocksTenants() {
        Instant futureEnd = Instant.now().plus(1, ChronoUnit.HOURS);
        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, true, "VYRO ERP is undergoing maintenance.", null, futureEnd.toString(),
                Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);
        MaintenanceInterceptor interceptor = new MaintenanceInterceptor(service);

        // 1. Super Admin is allowed through
        MockHttpServletRequest superAdminReq = new MockHttpServletRequest("GET", "/state");
        superAdminReq.setAttribute("com.quickerp.web.AuthInterceptor.principal",
                new Principal("admin-1", Principal.PLATFORM_TENANT, true, "role-super", "super@vyro.cloud"));
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(superAdminReq, res, new Object()));

        // 2. Tenant Admin is blocked with 503 PLATFORM_MAINTENANCE
        MockHttpServletRequest tenantAdminReq = new MockHttpServletRequest("GET", "/state");
        tenantAdminReq.setAttribute("com.quickerp.web.AuthInterceptor.principal",
                new Principal("usr-admin", "tenant-001", false, "role-001", "admin@tenant1.com"));
        ApiException exceptionAdmin = assertThrows(ApiException.class, () ->
                interceptor.preHandle(tenantAdminReq, res, new Object()));

        assertEquals(503, exceptionAdmin.getStatus());
        assertEquals("PLATFORM_MAINTENANCE", exceptionAdmin.getCode());
        assertEquals("VYRO ERP is undergoing maintenance.", exceptionAdmin.getMessage());
        assertNotNull(exceptionAdmin.getDetails());
        assertTrue(exceptionAdmin.getDetails().containsKey("expectedEndTime"));

        // 3. Regular Tenant user is also blocked with 503 PLATFORM_MAINTENANCE
        MockHttpServletRequest tenantUserReq = new MockHttpServletRequest("GET", "/sales/invoices");
        tenantUserReq.setAttribute("com.quickerp.web.AuthInterceptor.principal",
                new Principal("usr-sales", "tenant-002", false, "role-sales", "sales@tenant2.com"));
        ApiException exceptionUser = assertThrows(ApiException.class, () ->
                interceptor.preHandle(tenantUserReq, res, new Object()));

        assertEquals(503, exceptionUser.getStatus());
        assertEquals("PLATFORM_MAINTENANCE", exceptionUser.getCode());
    }

    @Test
    void testPublicEndpointsAllowedDuringMaintenance() {
        MaintenanceService.MaintenanceConfig base = new MaintenanceService.MaintenanceConfig(
                true, true, "VYRO ERP is undergoing maintenance.", null, null,
                Instant.now().toString(), "ops@vyro.cloud");
        TestableMaintenanceService service = new TestableMaintenanceService(mapper, base);
        MaintenanceInterceptor interceptor = new MaintenanceInterceptor(service);

        MockHttpServletRequest statusReq = new MockHttpServletRequest("GET", "/api/v1/platform/maintenance/status");
        MockHttpServletResponse res = new MockHttpServletResponse();
        assertTrue(interceptor.preHandle(statusReq, res, new Object()));

        MockHttpServletRequest healthReq = new MockHttpServletRequest("GET", "/api/v1/health");
        assertTrue(interceptor.preHandle(healthReq, res, new Object()));
    }
}
