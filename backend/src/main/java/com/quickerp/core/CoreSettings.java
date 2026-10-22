package com.quickerp.core;

import java.util.List;
import java.util.Set;

/** Settings used by the core services, built from application configuration. */
public record CoreSettings(
        String jwtSecret,
        long tokenTtlHours,
        String initialUserPassword,
        int maxLoginFailures,
        int lockMinutes,
        long maxRecordBytes,
        int maxBatchChanges,
        boolean historyEnabled,
        Set<String> sharedCollections,
        Set<String> publicReadableCollections,
        Set<String> publicWritableCollections,
        int publicWritesPerMinute,
        List<String> provisionCopyCollections,
        String passwordResetUrl,
        long maxFileBytes) {
}
