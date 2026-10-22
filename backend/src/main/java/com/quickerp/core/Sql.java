package com.quickerp.core;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;

/** JDBC and JSON helpers shared by the core services. */
final class Sql {

    private Sql() {
    }

    static PreparedStatement prepare(Connection connection, String sql, Object... params) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql);
        for (int index = 0; index < params.length; index++) {
            Object value = params[index];
            if (value instanceof Collection<?> values) {
                statement.setArray(index + 1, connection.createArrayOf("varchar", values.toArray()));
            } else {
                statement.setObject(index + 1, value);
            }
        }
        return statement;
    }

    static int update(Connection connection, String sql, Object... params) throws SQLException {
        try (PreparedStatement statement = prepare(connection, sql, params)) {
            return statement.executeUpdate();
        }
    }

    static long queryLong(Connection connection, String sql, Object... params) throws SQLException {
        try (PreparedStatement statement = prepare(connection, sql, params); ResultSet rows = statement.executeQuery()) {
            return rows.next() ? rows.getLong(1) : 0L;
        }
    }

    static String queryString(Connection connection, String sql, Object... params) throws SQLException {
        try (PreparedStatement statement = prepare(connection, sql, params); ResultSet rows = statement.executeQuery()) {
            return rows.next() ? rows.getString(1) : null;
        }
    }

    static void lock(Connection connection, String key) throws SQLException {
        try (PreparedStatement statement = prepare(connection, "SELECT pg_advisory_xact_lock(hashtext(?))", key)) {
            statement.execute(); // the lock is held until the transaction ends
        }
    }

    static JsonNode readJson(ObjectMapper mapper, String text) {
        if (text == null) return NullNode.getInstance();
        try {
            return mapper.readTree(text);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Stored JSON could not be read.", error);
        }
    }

    static String writeJson(ObjectMapper mapper, JsonNode node) {
        try {
            return mapper.writeValueAsString(node == null ? NullNode.getInstance() : node);
        } catch (JsonProcessingException error) {
            throw ApiException.badRequest("The record could not be read as JSON.");
        }
    }

    static String text(JsonNode node, String field) {
        if (node == null || !node.isObject()) return null;
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }
}
