package com.quickerp.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionGuardTest {

    @Test
    void developmentIsNotChecked() {
        assertTrue(ProductionGuard.problems(new AppProperties(), "quickerp").isEmpty());
    }

    @Test
    void productionDefaultsAreRefused() {
        AppProperties properties = new AppProperties();
        properties.setEnvironment("production");
        List<String> problems = ProductionGuard.problems(properties, "quickerp");
        // JWT secret, database password, seed password, demo data, initial password, access rules, reset URL.
        assertEquals(7, problems.size(), problems.toString());
    }

    @Test
    void safeProductionSettingsPass() {
        AppProperties properties = new AppProperties();
        properties.setEnvironment("production");
        properties.getJwt().setSecret("q7Vd9kR2mX4pL8sT1wY6zA3cF5hJ0nB7eG9uK2rM4tP");
        properties.getSeed().setDefaultPassword("A-very-strong-starter-password-2026");
        properties.getSeed().setDemoData(false);
        properties.getUsers().setInitialPassword("");
        properties.getCors().setAllowedOrigins(List.of("https://erp.example.lk"));
        properties.getMail().setPasswordResetUrl("https://erp.example.lk/reset-password");
        AppProperties.Rule rule = new AppProperties.Rule();
        rule.setCollection("core.roles");
        properties.getAccess().setRules(List.of(rule));
        assertEquals(List.of(), ProductionGuard.problems(properties, "a-strong-database-password"));
        properties.getCors().setAllowedOrigins(List.of("*"));
        assertEquals(1, ProductionGuard.problems(properties, "a-strong-database-password").size());
    }
}
