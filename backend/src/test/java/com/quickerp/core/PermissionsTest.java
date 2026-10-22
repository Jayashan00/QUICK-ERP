package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class PermissionsTest {

    @Test
    void exactAndWildcardPatterns() {
        Permissions permissions = Permissions.of(List.of("settings.printers.edit", "finance.journals.view"));
        assertTrue(permissions.matches("settings.printers.edit"));
        assertTrue(permissions.matches("settings.*.edit"));
        assertTrue(permissions.matches("finance.*"));
        assertFalse(permissions.matches("settings.*.delete"));
        assertFalse(permissions.matches("hr.*"));
        assertFalse(permissions.matches("finance.journals.post"));
    }

    @Test
    void wildcardPatternDoesNotTreatDotsAsRegex() {
        assertFalse(Permissions.of(List.of("settingsXprintersXedit")).matches("settings.*.edit"));
    }

    @Test
    void starGrantsEverythingButOnlyStarCoversStar() {
        Permissions admin = Permissions.everything();
        assertTrue(admin.matches("anything.at.all"));
        assertTrue(admin.covers(List.of("*")));
        Permissions manager = Permissions.of(List.of("a.b", "c.d"));
        assertTrue(manager.covers(List.of("a.b")));
        assertFalse(manager.covers(List.of("a.b", "e.f")));
        assertFalse(manager.covers(List.of("*")));
    }

    @Test
    void emptyRequirementIsSatisfied() {
        assertTrue(Permissions.none().matchesAny(List.of()));
        assertFalse(Permissions.none().matchesAny(List.of("x.y")));
    }
}
