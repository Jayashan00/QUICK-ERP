package com.quickerp.core;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;

/** Small JDBC transaction helper. */
public final class Db {

    @FunctionalInterface
    public interface Work<T> {
        T run(Connection connection) throws Exception;
    }

    private final DataSource dataSource;

    public Db(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /** Runs the work in a read-write transaction. */
    public <T> T tx(Work<T> work) {
        return run(work, false, Connection.TRANSACTION_READ_COMMITTED);
    }

    /** Runs the work in a read-only transaction that sees one consistent snapshot. */
    public <T> T snapshot(Work<T> work) {
        return run(work, true, Connection.TRANSACTION_REPEATABLE_READ);
    }

    private <T> T run(Work<T> work, boolean readOnly, int isolation) {
        try (Connection connection = dataSource.getConnection()) {
            boolean autoCommit = connection.getAutoCommit();
            int previousIsolation = connection.getTransactionIsolation();
            boolean previousReadOnly = connection.isReadOnly();
            try {
                connection.setAutoCommit(false);
                connection.setTransactionIsolation(isolation);
                connection.setReadOnly(readOnly);
                T result = work.run(connection);
                connection.commit();
                return result;
            } catch (Exception error) {
                try {
                    connection.rollback();
                } catch (SQLException ignored) {
                    // the original error is more useful
                }
                if (error instanceof RuntimeException runtime) throw runtime;
                throw new IllegalStateException("Database operation failed: " + error.getMessage(), error);
            } finally {
                connection.setReadOnly(previousReadOnly);
                connection.setTransactionIsolation(previousIsolation);
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException error) {
            throw new IllegalStateException("Database connection failed: " + error.getMessage(), error);
        }
    }
}
