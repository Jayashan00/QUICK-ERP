package com.quickerp.ai.data;

import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import com.quickerp.ai.AiModels.AccessContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.time.DayOfWeek;

/** Calendar periods are [startInclusive, endExclusive) in the tenant's timezone. */
public final class ErpDateRangeResolver {
    public record Range(LocalDate startInclusive, LocalDate endExclusive, String definition, String timezone) {}
    public Range resolve(String period, ZoneId zone, Clock clock, int number) {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate start;
        LocalDate end;
        switch (period) {
            case "today" -> { start = today; end = today.plusDays(1); }
            case "yesterday" -> { start = today.minusDays(1); end = today; }
            case "this_week" -> { start = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); end = start.plusWeeks(1); }
            case "last_week" -> { end = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); start = end.minusWeeks(1); }
            case "this_month" -> { start = today.withDayOfMonth(1); end = start.plusMonths(1); }
            case "last_month" -> { end = today.withDayOfMonth(1); start = end.minusMonths(1); }
            case "this_quarter" -> { start = LocalDate.of(today.getYear(), ((today.getMonthValue()-1)/3)*3+1, 1); end = start.plusMonths(3); }
            case "last_quarter" -> { end = LocalDate.of(today.getYear(), ((today.getMonthValue()-1)/3)*3+1, 1); start = end.minusMonths(3); }
            case "this_year" -> { start = today.withDayOfYear(1); end = start.plusYears(1); }
            case "last_year" -> { end = today.withDayOfYear(1); start = end.minusYears(1); }
            case "last_n_days" -> { requireNumber(number); end = today.plusDays(1); start = end.minusDays(number); }
            case "last_n_months" -> { requireNumber(number); end = YearMonth.from(today).plusMonths(1).atDay(1); start = end.minusMonths(number); }
            default -> throw ApiException.validation("period", "Unsupported date period.");
        }
        return new Range(start, end, period, zone.getId());
    }
    /** Reads the tenant's registered settings.general collection; UTC is explicit when it is absent. */
    public ZoneId tenantZone(Db db, AccessContext scope) {
        String configured = setting(db, scope, "settings.general").path("timezone").asText(null);
        if (configured == null || configured.isBlank()) return ZoneOffset.UTC;
        try { return ZoneId.of(configured); }
        catch (RuntimeException error) { throw new ApiException(422, "invalid_tenant_timezone", "The company timezone is invalid."); }
    }
    public Range resolveForTenant(String period, int number, Db db, AccessContext scope, Clock clock) {
        ZoneId zone = tenantZone(db, scope);
        if ("this_financial_year".equals(period) || "last_financial_year".equals(period))
            return financialYear(db, scope, clock, "last_financial_year".equals(period));
        if ("this_week".equals(period) || "last_week".equals(period)) {
            String firstDay = setting(db, scope, "settings.general").path("weekStartsOn").asText("monday");
            DayOfWeek day = "sunday".equals(firstDay) ? DayOfWeek.SUNDAY : DayOfWeek.MONDAY;
            LocalDate end = LocalDate.now(clock.withZone(zone)).with(TemporalAdjusters.previousOrSame(day));
            if ("this_week".equals(period)) return new Range(end, end.plusWeeks(1), period, zone.getId());
            return new Range(end.minusWeeks(1), end, period, zone.getId());
        }
        return resolve(period, zone, clock, number);
    }
    public Range financialYear(Db db, AccessContext scope, Clock clock, boolean previous) {
        ZoneId zone = tenantZone(db, scope);
        JsonNode config = setting(db, scope, "settings.financialYear");
        int month = config.path("startMonth").asInt(0), day = config.path("startDay").asInt(0);
        try {
            LocalDate today = LocalDate.now(clock.withZone(zone));
            LocalDate start = LocalDate.of(today.getYear(), month, day);
            if (start.isAfter(today)) start = start.minusYears(1);
            if (previous) start = start.minusYears(1);
            return new Range(start, start.plusYears(1), previous ? "last_financial_year" : "this_financial_year", zone.getId());
        } catch (RuntimeException error) { throw new ApiException(422, "invalid_tenant_financial_year", "The company financial-year start is unavailable or invalid."); }
    }
    private static JsonNode setting(Db db, AccessContext scope, String collection) {
        return db.snapshot(connection -> {
            try (var statement = connection.prepareStatement("SELECT data FROM erp_records "
                    + "WHERE tenant_id=? AND collection=? AND NOT deleted AND data IS NOT NULL "
                    + "AND record_id<>'__order__' LIMIT 1")) {
                statement.setString(1, scope.tenantId()); statement.setString(2, collection);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next()) return new ObjectMapper().createObjectNode();
                    JsonNode value = new ObjectMapper().readTree(rows.getString(1));
                    return value.isArray() && !value.isEmpty() ? value.get(0) : value;
                }
            }
        });
    }
    public Range custom(String start, String end, ZoneId zone) {
        try {
            LocalDate first = LocalDate.parse(start), last = LocalDate.parse(end);
            if (!first.isBefore(last) || first.plusYears(10).isBefore(last)) throw new IllegalArgumentException();
            return new Range(first, last, "custom", zone.getId());
        } catch (RuntimeException error) { throw ApiException.validation("dateRange", "A valid start-inclusive and end-exclusive date range is required."); }
    }
    private static void requireNumber(int number) {
        if (number < 1 || number > 366) throw ApiException.validation("period", "Period length is out of range.");
    }
}
